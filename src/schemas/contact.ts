import { z } from 'zod';

export const ContactSchema = z
  .object({
    id: z.number(),
    email: z.string().nullish(),
  })
  .passthrough();

export type Contact = z.infer<typeof ContactSchema>;

export const ContactWriteSchema = z
  .object({
    first_name: z.string().optional().describe('Given name.'),
    family_name: z.string().optional().describe('Family name.'),
    email: z.string().optional().describe('Email address.'),
    phone: z.string().optional().describe('Phone number.'),
  })
  .strict();

export const ContactListSchema = z.array(ContactSchema);
export type ContactList = z.infer<typeof ContactListSchema>;

export const EnrichedContactSchema = z
  .object({
    id: z.number(),
    email: z.string().nullish(),
    is_synthetic_email: z.boolean(),
  })
  .passthrough();

export type EnrichedContact = z.infer<typeof EnrichedContactSchema>;

export const ListContactsOutputSchema = z.object({
  contacts: z.array(EnrichedContactSchema),
});
