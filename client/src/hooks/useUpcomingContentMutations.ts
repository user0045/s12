
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UpcomingContentData {
  title: string;
  contentType: string;
  releaseDate: string;
  ratingType?: string;
  description: string;
  thumbnailUrl: string;
  trailerUrl: string;
  contentOrder: string;
  selectedGenres: string[];
  directors: string[];
  writers: string[];
  cast: string[];
}

export const useCreateUpcomingContent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpcomingContentData) => {
      console.log('Creating upcoming content:', data);
      
      // Check if we already have 20 announcements
      const { data: existingContent, error: countError } = await supabase
        .from('upcoming_content')
        .select('id', { count: 'exact' });

      if (countError) throw countError;
      
      if (existingContent && existingContent.length >= 20) {
        throw new Error('Maximum of 20 announcements allowed. Please delete some existing announcements first.');
      }

      const targetOrder = parseInt(data.contentOrder);

      // Check if the content_order already exists
      const { data: existingOrder, error: orderError } = await supabase
        .from('upcoming_content')
        .select('id, content_order')
        .eq('content_order', targetOrder);

      if (orderError) throw orderError;

      // If content_order exists, increment all orders >= targetOrder
      if (existingOrder && existingOrder.length > 0) {
        // Get all records that need to be incremented
        const { data: recordsToUpdate, error: fetchError } = await supabase
          .from('upcoming_content')
          .select('id, content_order')
          .gte('content_order', targetOrder);

        if (fetchError) throw fetchError;

        // Update each record individually
        for (const record of recordsToUpdate || []) {
          const { error: updateError } = await supabase
            .from('upcoming_content')
            .update({ content_order: record.content_order + 1 })
            .eq('id', record.id);

          if (updateError) throw updateError;
        }
      }

      const { data: result, error } = await supabase
        .from('upcoming_content')
        .insert([{
          title: data.title,
          content_type: data.contentType as any,
          genre: data.selectedGenres,
          release_date: data.releaseDate,
          content_order: targetOrder,
          rating_type: data.ratingType as any,
          directors: data.directors,
          writers: data.writers,
          cast_members: data.cast,
          thumbnail_url: data.thumbnailUrl,
          description: data.description,
          trailer_url: data.trailerUrl,
        }])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: async () => {
      // Clean up expired announcements (release date + 1 day has passed)
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      
      await supabase
        .from('upcoming_content')
        .delete()
        .lt('release_date', yesterdayDate.toISOString().split('T')[0]);

      toast({ title: "Success", description: "Upcoming content announced successfully!" });
      queryClient.invalidateQueries({ queryKey: ['upcoming-content'] });
    },
    onError: (error: any) => {
      console.error('Error creating upcoming content:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to announce content", 
        variant: "destructive" 
      });
    },
  });
};

export const useUpdateUpcomingContent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & UpcomingContentData) => {
      console.log('Updating upcoming content:', id, data);
      
      const targetOrder = parseInt(data.contentOrder);

      // Get current content order for this item
      const { data: currentContent, error: currentError } = await supabase
        .from('upcoming_content')
        .select('content_order')
        .eq('id', id)
        .single();

      if (currentError) throw currentError;

      // If content_order is changing, handle conflicts
      if (currentContent.content_order !== targetOrder) {
        // Check if the target content_order already exists (excluding current item)
        const { data: existingOrder, error: orderError } = await supabase
          .from('upcoming_content')
          .select('id, content_order')
          .eq('content_order', targetOrder)
          .neq('id', id);

        if (orderError) throw orderError;

        // If target order exists, increment all orders >= targetOrder (excluding current item)
        if (existingOrder && existingOrder.length > 0) {
          // Get all records that need to be incremented (excluding current item)
          const { data: recordsToUpdate, error: fetchError } = await supabase
            .from('upcoming_content')
            .select('id, content_order')
            .gte('content_order', targetOrder)
            .neq('id', id);

          if (fetchError) throw fetchError;

          // Update each record individually
          for (const record of recordsToUpdate || []) {
            const { error: updateError } = await supabase
              .from('upcoming_content')
              .update({ content_order: record.content_order + 1 })
              .eq('id', record.id);

            if (updateError) throw updateError;
          }
        }
      }

      const { data: result, error } = await supabase
        .from('upcoming_content')
        .update({
          title: data.title,
          content_type: data.contentType as any,
          genre: data.selectedGenres,
          release_date: data.releaseDate,
          content_order: targetOrder,
          rating_type: data.ratingType as any,
          directors: data.directors,
          writers: data.writers,
          cast_members: data.cast,
          thumbnail_url: data.thumbnailUrl,
          description: data.description,
          trailer_url: data.trailerUrl,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Upcoming content updated successfully!" });
      queryClient.invalidateQueries({ queryKey: ['upcoming-content'] });
    },
    onError: (error) => {
      console.error('Error updating upcoming content:', error);
      toast({ title: "Error", description: "Failed to update content", variant: "destructive" });
    },
  });
};

export const useDeleteUpcomingContent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting upcoming content:', id);
      
      const { error } = await supabase
        .from('upcoming_content')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Upcoming content deleted successfully!" });
      queryClient.invalidateQueries({ queryKey: ['upcoming-content'] });
    },
    onError: (error) => {
      console.error('Error deleting upcoming content:', error);
      toast({ title: "Error", description: "Failed to delete content", variant: "destructive" });
    },
  });
};
