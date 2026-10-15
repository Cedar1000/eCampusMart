-- Merges categories that share a name (ignoring case and spaces) into the oldest one,
-- moving everything that points at a duplicate over first.
BEGIN;

-- Product categories
CREATE TEMP TABLE product_category_merge ON COMMIT DROP AS
SELECT id AS duplicate_id, keep_id
FROM (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY LOWER(TRIM(name)) ORDER BY "createdAt", id
         ) AS keep_id
  FROM product_category
) ranked
WHERE id <> keep_id;

UPDATE product p SET "categoryId" = m.keep_id
FROM product_category_merge m WHERE p."categoryId"::text = m.duplicate_id::text;

UPDATE product_store s SET "categoryId" = m.keep_id
FROM product_category_merge m WHERE s."categoryId"::text = m.duplicate_id::text;

DELETE FROM product_category c
USING product_category_merge m WHERE c.id = m.duplicate_id;

-- Service categories
CREATE TEMP TABLE service_category_merge ON COMMIT DROP AS
SELECT id AS duplicate_id, keep_id
FROM (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY LOWER(TRIM(name)) ORDER BY "createdAt", id
         ) AS keep_id
  FROM service_category
) ranked
WHERE id <> keep_id;

UPDATE service s SET "categoryId" = m.keep_id
FROM service_category_merge m WHERE s."categoryId"::text = m.duplicate_id::text;

UPDATE service_store s SET "categoryId" = m.keep_id
FROM service_category_merge m WHERE s."categoryId"::text = m.duplicate_id::text;

DELETE FROM service_category c
USING service_category_merge m WHERE c.id = m.duplicate_id;

COMMIT;
