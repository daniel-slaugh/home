import { glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'

const recipes = defineCollection({
  loader: glob({ base: './src/content/recipes', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    serves: z.number(),
    prepTime: z.string(),
    cookTime: z.string(),
    ingredients: z.array(
      z.union([
        z.object({ title: z.string() }),
        z.object({
          name: z.string(),
          quantity: z.number(),
          unit: z.string(),
        }),
      ]),
    ),
    pubDate: z.coerce.date(),
    heroImage: z.string().optional(),
  }),
})

export const collections = { recipes }
