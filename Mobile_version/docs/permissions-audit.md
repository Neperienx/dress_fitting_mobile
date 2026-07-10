# Permissions Audit

Last updated: July 7, 2026

## Intended permissions

Bridal Studio needs network access for Supabase, inventory images, authentication, and normal app traffic.

The app also needs user-selected image/file access so store owners can upload dress and ring inventory photos from the device photo library or file picker.

## iOS

Configured in `app.json`:

- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`

The app does not intentionally request camera, microphone, location, contacts, Bluetooth, SMS, or phone-call access.

## Android

Configured in `app.json`:

- unwanted dangerous permissions are listed in `android.blockedPermissions`;
- image/file picker permissions are not blocked because inventory upload depends on user-selected photos/files;
- network access is expected.

Blocked permission groups:

- camera;
- microphone;
- fine/coarse/background location;
- contacts/accounts;
- Bluetooth scan/connect/advertise/admin;
- SMS/MMS;
- phone calls, phone state, and call logs.

## Release verification

Before Play Console submission, inspect the generated Android manifest or app bundle permissions and confirm the final build does not request any blocked capability. This final check should happen after the first EAS Android production build because native dependencies and build tooling produce the definitive manifest.
