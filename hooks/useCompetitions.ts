import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Competition, Participant } from '@/lib/types';

export function useMyCompetitions(userId: string | undefined) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);

    const { data: participantRows } = await supabase
      .from('participants')
      .select('competition_id')
      .eq('user_id', userId);

    if (!participantRows?.length) {
      setCompetitions([]);
      setLoading(false);
      return;
    }

    const ids = participantRows.map((p) => p.competition_id);
    const { data } = await supabase
      .from('competitions')
      .select('*, creator:profiles!creator_id(display_name, avatar_url)')
      .in('id', ids)
      .order('created_at', { ascending: false });

    setCompetitions((data as Competition[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { competitions, loading, refetch: fetch };
}

export function usePublicCompetitions() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('competitions')
      .select('*, creator:profiles!creator_id(display_name, avatar_url)')
      .eq('is_public', true)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(20);

    setCompetitions((data as Competition[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { competitions, loading, refetch: fetch };
}

export function useCompetitionDetail(competitionId: string) {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);

    const [compRes, partRes] = await Promise.all([
      supabase
        .from('competitions')
        .select('*, creator:profiles!creator_id(*)')
        .eq('id', competitionId)
        .single(),
      supabase
        .from('participants')
        .select('*, profile:profiles!user_id(*)')
        .eq('competition_id', competitionId)
        .order('total_points', { ascending: false })
        .order('best_streak', { ascending: false })
        .order('joined_at', { ascending: true }),
    ]);

    setCompetition(compRes.data as Competition | null);
    setParticipants((partRes.data as Participant[]) ?? []);
    setLoading(false);
  }, [competitionId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { competition, participants, loading, refetch: fetch };
}
