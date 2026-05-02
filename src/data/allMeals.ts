import { mealDatabase } from './mealDatabase';
import { importedMealDatabase } from './importedMeals';

export const allMeals = [...mealDatabase, ...importedMealDatabase];
