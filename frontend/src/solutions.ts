import { algorithmSolutions } from './algorithmSolutions'
import { graphSolutions } from './graphSolutions'
import { patternSolutions } from './patternSolutions'
import { otherSolutions } from './otherSolutions'
import { naiveAlgorithms } from './naiveAlgorithms'
import { naiveGraphs } from './naiveGraphs'
import { naivePatterns } from './naivePatterns'
import { naiveOther } from './naiveOther'

export type Solution = { name: string; explanation: string; code: string; complexity: string }

export const solutions: Record<string, Solution> = {
  ...algorithmSolutions,
  ...graphSolutions,
  ...patternSolutions,
  ...otherSolutions,
}

export const additionalSolutions: Record<string, Solution[]> = {
  ...naiveAlgorithms,
  ...naiveGraphs,
  ...naivePatterns,
  ...naiveOther,
}
