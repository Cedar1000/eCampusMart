-- Photos whose stored key is missing the Cloudinary folder (e.g. "irrlliro3rcgryoworfe"
-- instead of "ECampusMart/irrlliro3rcgryoworfe"), so they can't be deleted from Cloudinary.
-- Only rows whose url shows the key inside the ECampusMart folder are changed.
BEGIN;

UPDATE product_image SET key = 'ECampusMart/' || key
WHERE key NOT LIKE '%/%' AND url LIKE '%/ECampusMart/' || key || '.%';

UPDATE service_image SET key = 'ECampusMart/' || key
WHERE key NOT LIKE '%/%' AND url LIKE '%/ECampusMart/' || key || '.%';

UPDATE housing_image SET key = 'ECampusMart/' || key
WHERE key NOT LIKE '%/%' AND url LIKE '%/ECampusMart/' || key || '.%';

UPDATE product_store SET "logoKey" = 'ECampusMart/' || "logoKey"
WHERE "logoKey" NOT LIKE '%/%' AND logo LIKE '%/ECampusMart/' || "logoKey" || '.%';

UPDATE product_store SET "bannerKey" = 'ECampusMart/' || "bannerKey"
WHERE "bannerKey" NOT LIKE '%/%' AND banner LIKE '%/ECampusMart/' || "bannerKey" || '.%';

UPDATE service_store SET "logoKey" = 'ECampusMart/' || "logoKey"
WHERE "logoKey" NOT LIKE '%/%' AND logo LIKE '%/ECampusMart/' || "logoKey" || '.%';

UPDATE service_store SET "bannerKey" = 'ECampusMart/' || "bannerKey"
WHERE "bannerKey" NOT LIKE '%/%' AND banner LIKE '%/ECampusMart/' || "bannerKey" || '.%';

UPDATE "user" SET "photoKey" = 'ECampusMart/' || "photoKey"
WHERE "photoKey" NOT LIKE '%/%' AND photo LIKE '%/ECampusMart/' || "photoKey" || '.%';

COMMIT;
