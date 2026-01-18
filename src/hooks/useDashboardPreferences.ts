import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardPreferences {
  cardOrder: string[];
  hiddenCards: string[];
}

const DEFAULT_CARD_ORDER = [
  'inspection',
  'assembly',
  'shipments',
  'putaway',
];

export function useDashboardPreferences() {
  const { profile } = useAuth();
  const [preferences, setPreferences] = useState<DashboardPreferences>({
    cardOrder: DEFAULT_CARD_ORDER,
    hiddenCards: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_dashboard_preferences')
        .select('card_order, hidden_cards')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (!error && data) {
        setPreferences({
          cardOrder: (data.card_order as string[]) || DEFAULT_CARD_ORDER,
          hiddenCards: (data.hidden_cards as string[]) || [],
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard preferences:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updateCardOrder = async (newOrder: string[]) => {
    if (!profile?.id) return;

    setPreferences(prev => ({ ...prev, cardOrder: newOrder }));

    try {
      const { error } = await supabase
        .from('user_dashboard_preferences')
        .upsert({
          user_id: profile.id,
          card_order: newOrder,
          hidden_cards: preferences.hiddenCards,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving card order:', error);
      // Revert on error
      fetchPreferences();
    }
  };

  const toggleCardVisibility = async (cardId: string) => {
    if (!profile?.id) return;

    const newHidden = preferences.hiddenCards.includes(cardId)
      ? preferences.hiddenCards.filter(id => id !== cardId)
      : [...preferences.hiddenCards, cardId];

    setPreferences(prev => ({ ...prev, hiddenCards: newHidden }));

    try {
      const { error } = await supabase
        .from('user_dashboard_preferences')
        .upsert({
          user_id: profile.id,
          card_order: preferences.cardOrder,
          hidden_cards: newHidden,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving hidden cards:', error);
      fetchPreferences();
    }
  };

  const resetToDefault = async () => {
    if (!profile?.id) return;

    setPreferences({
      cardOrder: DEFAULT_CARD_ORDER,
      hiddenCards: [],
    });

    try {
      await supabase
        .from('user_dashboard_preferences')
        .delete()
        .eq('user_id', profile.id);
    } catch (error) {
      console.error('Error resetting preferences:', error);
    }
  };

  return {
    preferences,
    loading,
    updateCardOrder,
    toggleCardVisibility,
    resetToDefault,
    DEFAULT_CARD_ORDER,
  };
}
