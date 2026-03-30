import { SessionDress, SwipeDecision } from './sessionHistory';

export type LogisticRankedDress = {
  dress: SessionDress;
  score: number;
  probability: number;
};

type LogisticRankingOptions = {
  dresses: SessionDress[];
  dressDecisions: Record<string, SwipeDecision>;
};

const EPOCHS = 140;
const LEARNING_RATE = 0.35;
const L2_REGULARIZATION = 0.002;

function sigmoid(value: number) {
  if (value >= 0) {
    const expValue = Math.exp(-value);
    return 1 / (1 + expValue);
  }

  const expValue = Math.exp(value);
  return expValue / (1 + expValue);
}

function getDecisionLabel(decision: SwipeDecision) {
  return decision === 'dislike' ? 0 : 1;
}

function getDecisionWeight(decision: SwipeDecision) {
  if (decision === 'superlike') {
    return 1.4;
  }

  return 1;
}

export function rankDressesWithLogisticModel({ dresses, dressDecisions }: LogisticRankingOptions): LogisticRankedDress[] {
  if (dresses.length === 0) {
    return [];
  }

  const vocabulary = Array.from(new Set(dresses.flatMap((dress) => dress.tags))).sort();
  const tagToIndex = new Map(vocabulary.map((tag, index) => [tag, index]));

  const featuresByDressId = new Map(
    dresses.map((dress) => {
      const vector = new Array(vocabulary.length).fill(0);
      dress.tags.forEach((tag) => {
        const index = tagToIndex.get(tag);
        if (typeof index === 'number') {
          vector[index] = 1;
        }
      });

      return [dress.id, vector] as const;
    })
  );

  const trainingSamples = Object.entries(dressDecisions)
    .map(([dressId, decision]) => {
      const features = featuresByDressId.get(dressId);
      if (!features) {
        return null;
      }

      return {
        features,
        label: getDecisionLabel(decision),
        weight: getDecisionWeight(decision)
      };
    })
    .filter((entry): entry is { features: number[]; label: 0 | 1; weight: number } => Boolean(entry));

  if (trainingSamples.length === 0 || vocabulary.length === 0) {
    return dresses
      .map((dress) => ({ dress, score: 0, probability: 0.5 }))
      .sort((a, b) => b.probability - a.probability || a.dress.name?.localeCompare(b.dress.name ?? '') || 0);
  }

  const weights = new Array(vocabulary.length).fill(0);
  let bias = 0;

  for (let epoch = 0; epoch < EPOCHS; epoch += 1) {
    const gradient = new Array(vocabulary.length).fill(0);
    let biasGradient = 0;

    trainingSamples.forEach(({ features, label, weight }) => {
      const linearScore = features.reduce((sum, value, index) => sum + value * weights[index], bias);
      const prediction = sigmoid(linearScore);
      const error = (prediction - label) * weight;

      biasGradient += error;
      for (let index = 0; index < weights.length; index += 1) {
        gradient[index] += error * features[index];
      }
    });

    const sampleCount = trainingSamples.length;

    for (let index = 0; index < weights.length; index += 1) {
      const regularization = L2_REGULARIZATION * weights[index];
      weights[index] -= LEARNING_RATE * (gradient[index] / sampleCount + regularization);
    }
    bias -= LEARNING_RATE * (biasGradient / sampleCount);
  }

  return dresses
    .map((dress) => {
      const features = featuresByDressId.get(dress.id) ?? [];
      const linearScore = features.reduce((sum, value, index) => sum + value * weights[index], bias);
      const probability = sigmoid(linearScore);

      return {
        dress,
        score: linearScore,
        probability
      };
    })
    .sort((a, b) => b.probability - a.probability || b.score - a.score);
}
