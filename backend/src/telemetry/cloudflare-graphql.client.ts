const GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

type GraphQLResponse<T> = {
  data: T | null;
  errors?: { message: string }[];
};

// Thin wrapper, not a full GraphQL client — this pipeline only ever runs one
// query shape (telemetry-cloudflare-pull.processor.ts's
// httpRequestsAdaptiveGroups pull), so there's nothing here worth a real
// client library for. GraphQL returns HTTP 200 even on query failure
// (confirmed against Cloudflare's docs — cloudflare skill's
// graphql-api/gotchas.md) — `response.ok` alone would silently swallow a
// malformed query or an expired token, so `json.errors` has to be checked
// explicitly.
export async function queryCloudflareGraphQL<T>(
  apiToken: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(
      `Cloudflare GraphQL request failed: HTTP ${response.status}`,
    );
  }
  const json = (await response.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(
      `Cloudflare GraphQL query returned errors: ${json.errors.map((e) => e.message).join('; ')}`,
    );
  }
  if (json.data === null) {
    throw new Error('Cloudflare GraphQL query returned no data');
  }
  return json.data;
}
