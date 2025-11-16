import type { Id, TableNames } from '@convex/_generated/dataModel';
import { z } from 'zod';

export const zodConvexId = <T extends TableNames>() => z.custom<Id<T>>((val) => typeof val === 'string');
