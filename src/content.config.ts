import { glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'

const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Transform string to Date object
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
  }),
})

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

export const collections = { blog, recipes }
