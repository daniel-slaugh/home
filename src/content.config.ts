import { glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'

const mealTypes = ['Main', 'Side', 'Dessert'] as const
const cuisines = [
  'American',
  'Southwest / Tex-Mex',
  'Italian',
  'Asian-Inspired',
  'Mediterranean',
  'Middle Eastern',
  'Indian',
  'Caribbean',
  'European (Non-Italian)',
  'Global / Fusion',
] as const
const cookingMethods = ['Oven', 'Stovetop', 'Slow Cooker', 'Instant Pot', 'Grill', 'No-Cook'] as const
const recipeTags = ['Vegetarian', 'Gluten-Free', 'Dairy-Free', 'One Pan', 'Make Ahead'] as const

const recipes = defineCollection({
  loader: glob({ base: './src/content/recipes', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        description: z.string(),
        serves: z.number(),
        prepTime: z.string(),
        cookTime: z.string(),
        activeTimeMinutes: z.number().int().nonnegative(),
        totalTimeMinutes: z.number().int().nonnegative(),
        inactiveTime: z.string().optional(),
        inactiveTimeMinutes: z.number().int().nonnegative().optional(),
        course: z.array(z.enum(mealTypes)).nonempty(),
        cuisine: z.array(z.enum(cuisines)).nonempty(),
        cookingMethod: z.array(z.enum(cookingMethods)).nonempty(),
        tags: z.array(z.enum(recipeTags)),
        ingredients: z.array(
          z.union([
            z.object({ title: z.string() }),
            z.object({
              name: z.string(),
              quantity: z.number(),
              unit: z.string(),
            }),
          ])
        ),
        pubDate: z.coerce.date(),
        heroImage: image().optional(),
      })
      .refine((data) => data.totalTimeMinutes >= data.activeTimeMinutes, {
        message: '`totalTimeMinutes` must be >= `activeTimeMinutes`',
      })
      .refine(
        (data) =>
          data.inactiveTimeMinutes === undefined ||
          data.totalTimeMinutes >= data.activeTimeMinutes + data.inactiveTimeMinutes,
        {
          message: '`totalTimeMinutes` must be >= `activeTimeMinutes` + `inactiveTimeMinutes`',
        }
      ),
})

export const collections = { recipes }
