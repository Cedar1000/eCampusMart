// Always loads `base`, plus any `allowed` relation the client asked for with ?relations=
export const withRelations = (
  requested: string | undefined,
  base: string[],
  allowed: string[],
) => {
  const extra = (requested?.split(',') ?? [])
    .map((relation) => relation.trim())
    .filter((relation) => allowed.includes(relation));

  return [...new Set([...base, ...extra])].join(',');
};
