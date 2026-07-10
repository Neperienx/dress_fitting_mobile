# Privacy Policy

Last updated: July 6, 2026

## 1. Pilot-phase notice

Bridal Studio is currently a pilot-phase product. It is not officially open to the general public. Please contact the operator before creating an account so that we can confirm whether the pilot is appropriate for your store and support your onboarding.

Contact: [INSERT SUPPORT EMAIL OR CONTACT URL]

This Privacy Policy explains how Bridal Studio collects, uses, stores, shares, and protects information when you use the mobile application and related services.

## 2. Who we are

Bridal Studio is operated by:

- Operator: [INSERT LEGAL NAME OR BUSINESS NAME]
- Contact: [INSERT SUPPORT EMAIL OR CONTACT URL]
- Location: [INSERT COUNTRY/REGION]

For privacy questions, access requests, correction requests, deletion requests, or complaints, contact us using the details above.

## 3. Scope

This policy applies to the Bridal Studio mobile app, backend services, pilot onboarding, and related support communications.

The app is designed for bridal boutiques, engagement ring stores, and their authorized team members. It is not intended for children and should not be used by anyone under the age of 16, or under the minimum age required by local law.

## 4. Information we collect

We collect only the information needed to operate the pilot and provide the app features.

### Account information

When you create or use an account, we may collect:

- username or email-like login identifier;
- authentication identifiers created by Supabase Auth;
- password credentials, handled by Supabase Auth and not visible to us in plain text;
- account status, account deletion request status, and related support notes.

### Store and team information

When you create or join a store, we may collect:

- store name;
- store location or city, if provided;
- store type, such as wedding dresses or engagement rings;
- user role, such as owner or member;
- invite codes, join requests, approval status, and the username or account label of the requesting user.

### Inventory content

When store owners manage inventory, we may collect:

- dress or ring profile names;
- optional price information;
- uploaded inventory photos;
- image URLs and storage paths;
- tags or attributes associated with inventory;
- timestamps and identifiers needed to sync, cache, update, or delete inventory records.

You are responsible for making sure you have the rights and permissions needed to upload any photos or other content to the app. Avoid uploading personal images of customers, staff, or other people unless you have appropriate permission.

### Session and styling information

When users run styling or shortlist sessions, we may collect or store:

- session queues and selected inventory items;
- likes, dislikes, super-likes, shortlist decisions, and ranking outputs;
- bride or customer name if manually entered;
- session feedback, reactions, and comments;
- local session history stored on the device.

### Device and local app data

The app stores some data locally on your device to make the app faster and usable between loads. This may include:

- authentication session tokens in secure app storage mechanisms provided through React Native storage;
- selected store ID;
- cached inventory metadata;
- cached image URLs and downloaded image files;
- local tag selections;
- local session history and shortlist history;
- temporary files used for image upload or sharing.

This local data may remain on the device until you clear app storage, uninstall the app, sign out where applicable, or the app overwrites/removes it.

### Photos and file access

The app may ask for access to your photo library or files so that you can select inventory images. The app uses this access only for the images you choose to add to inventory. The app does not scan your full photo library or upload photos you did not select.

### Support communications

If you contact us, we may collect the information you provide in that communication, such as your name, email address, store name, issue description, and any diagnostic context you choose to share.

## 5. How we use information

We use collected information to:

- create, authenticate, and manage accounts;
- create stores and manage store membership;
- generate and approve invite/join workflows;
- upload, display, sync, cache, and manage inventory profiles;
- allow team members to run sessions and view store inventory;
- save session feedback and local session history;
- troubleshoot bugs, support onboarding, and improve product reliability;
- prevent unauthorized access, misuse, or policy violations;
- comply with legal, security, and app-store obligations.

We do not sell personal information. We do not use inventory content for advertising. We do not use customer or boutique inventory content to train AI models.

## 6. Pilot access and account creation

Because Bridal Studio is in pilot phase, accounts should only be created by users who have contacted us or have been invited by an approved store owner. We may suspend or remove accounts created without authorization, accounts that appear abusive, or accounts that interfere with pilot operations.

If you created an account by mistake, contact us or use the in-app account deletion request flow.

## 7. AI and debug features

The app has included a debug-only OpenAI inventory image generation feature during development. This feature is gated for development builds and is not intended for production release.

If this feature is ever enabled during a controlled pilot, prompts and generated outputs may be sent to OpenAI solely to generate debug inventory images. Do not enter personal data, confidential business information, customer names, or sensitive content into AI prompts. The production app should not expose this debug feature or bundle an OpenAI API key.

If AI generation later becomes a public product feature, this Privacy Policy should be updated before release to explain the feature, data flow, provider, retention, user controls, and any applicable consent requirements.

## 8. How we share information

We share information only as needed to operate the app and pilot.

### Service providers

We use Supabase for backend infrastructure, including authentication, database, storage, and related backend services. Supabase may process app data on our behalf as a service provider or processor.

We may use Expo and related development/build tooling to build, test, and distribute app versions. Expo Go and development tooling may process technical information needed for development and testing.

If debug AI generation is enabled in development, OpenAI may process prompts and generated image requests for that limited debug purpose.

### Store members

Store inventory, tags, session data, and related content may be visible to authorized users who are members of the same store, according to their role. Store owners can manage inventory and approve join requests. Members may view inventory and run sessions, but should not have owner-level inventory management access.

### Legal and safety

We may disclose information if required by law, regulation, legal process, or a valid governmental request, or if we believe disclosure is reasonably necessary to protect rights, safety, security, or prevent misuse.

## 9. Security

We use technical and organizational safeguards appropriate for a pilot-stage app, including:

- Supabase authentication;
- row-level security policies for store and inventory access;
- role-based access controls for store owners and members;
- HTTPS/TLS transport where supported by the backend provider;
- environment-based separation between local development and production Supabase configuration;
- gitignored local environment files for secrets and private configuration;
- production gating for debug-only AI generation.

No system can be guaranteed to be completely secure. You are responsible for using strong passwords, limiting invite-code sharing, and ensuring that only authorized team members access your store.

## 10. Data retention

We retain information for as long as needed to operate the pilot, provide the service, comply with legal obligations, resolve disputes, maintain security, and support store continuity.

General retention approach:

- account records are retained while your account is active;
- store records, inventory profiles, uploaded images, tags, roles, and session data are retained while the store remains active;
- local device caches may remain until cleared by the app, device operating system, user action, or app uninstall;
- support messages may be retained as needed for support, compliance, and audit history;
- account deletion requests are retained as needed to process and document the request.

Deleting a user account does not automatically delete the store or its inventory. This is intentional so that a store is not lost if an individual user deletes an account by mistake or leaves a store. Store deletion is a separate workflow and should be requested separately by an authorized store owner.

## 11. Account deletion and data deletion

The app includes an in-app account deletion request flow. You can request account deletion from the account/home screen in the app.

When you request account deletion, we will review and process the request. Depending on the data type and legal or operational context:

- your user account may be deleted or deactivated;
- your profile/account identifiers may be removed or disassociated;
- store data may be preserved if it belongs to a store with other users or if preserving it is necessary to avoid deleting shared business records;
- inventory and store content may require a separate store deletion request by an authorized store owner;
- certain records may be retained where reasonably necessary for legal, security, fraud-prevention, audit, dispute-resolution, or backup purposes.

For Google Play and other app-store requirements, an external account deletion request page or contact route should be published before public release.

## 12. Your rights and choices

Depending on where you live, you may have rights to:

- access personal information we hold about you;
- correct inaccurate information;
- request deletion;
- object to or restrict certain processing;
- request a copy of your information;
- withdraw consent where processing is based on consent;
- complain to a data protection authority.

To exercise these rights, contact us at [INSERT SUPPORT EMAIL OR CONTACT URL]. We may need to verify your identity and your authority to act for a store before fulfilling requests.

## 13. International transfers

Our service providers may process or store information in countries other than your own. Where required, we rely on appropriate legal mechanisms and provider commitments for cross-border transfers.

## 14. Children

Bridal Studio is not directed to children. Do not create an account or use the app if you are under 16 or under the minimum age required by local law. We do not knowingly collect information from children. If you believe a child has provided information, contact us so we can review and delete it where appropriate.

## 15. Changes to this policy

Because Bridal Studio is in pilot phase, the product and this Privacy Policy may change. We will update the "Last updated" date when changes are made. Material changes should be communicated through appropriate channels, such as app updates, release notes, email, or pilot onboarding communications.

## 16. Contact

For privacy questions, account deletion, store deletion, onboarding, or support:

[INSERT SUPPORT EMAIL OR CONTACT URL]
