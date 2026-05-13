import { z } from 'zod';

export const ContactSchema = z
  .object({
    id: z.number(),
    email: z.string().nullish(),
  })
  .passthrough();

export type Contact = z.infer<typeof ContactSchema>;

export const ContactListSchema = z.array(ContactSchema);
export type ContactList = z.infer<typeof ContactListSchema>;
