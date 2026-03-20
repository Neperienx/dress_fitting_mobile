import AsyncStorage from '@react-native-async-storage/async-storage';

export type SwipeDecision = 'like' | 'dislike' | 'superlike';
export type SessionFeedbackReaction = 'up' | 'down';

export type SessionPreviewDress = {
  id: string;
  name: string | null;
  price: number | null;
  created_at: string;
  dress_images: { id: string; image_url: string; sort_order: number }[];
};

export type SessionDress = SessionPreviewDress & {
  tags: string[];
};

export type TagSummary = {
  likes: number;
  dislikes: number;
  score: number;
};

export type SavedSession = {
  id: string;
  storeId: string;
  brideName: string;
  endedAt: string;
  sessionQueue: SessionDress[];
  allStoreDresses: SessionDress[];
  tagScores: Record<string, TagSummary>;
  dressDecisions: Record<string, SwipeDecision>;
  shortlistDressIds?: string[];
  feedbackReaction?: SessionFeedbackReaction;
  feedbackComment?: string;
  feedbackSubmittedAt?: string;
};

function getSessionHistoryKey(storeId: string) {
  return `session-history:${storeId}`;
}

export async function loadSessionHistory(storeId: string): Promise<SavedSession[]> {
  const raw = await AsyncStorage.getItem(getSessionHistoryKey(storeId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is SavedSession => Boolean(entry?.id && entry?.storeId));
  } catch {
    return [];
  }
}

export async function prependSessionHistory(storeId: string, record: SavedSession) {
  const existing = await loadSessionHistory(storeId);
  const next = [record, ...existing].slice(0, 100);
  await AsyncStorage.setItem(getSessionHistoryKey(storeId), JSON.stringify(next));
}

export async function updateSessionHistoryRecord(
  storeId: string,
  sessionId: string,
  updates: Partial<
    Pick<SavedSession, 'shortlistDressIds' | 'feedbackReaction' | 'feedbackComment' | 'feedbackSubmittedAt'>
  >
) {
  const existing = await loadSessionHistory(storeId);
  const next = existing.map((entry) => (entry.id === sessionId ? { ...entry, ...updates } : entry));
  await AsyncStorage.setItem(getSessionHistoryKey(storeId), JSON.stringify(next));
}
