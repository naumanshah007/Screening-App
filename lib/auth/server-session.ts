import { cache } from "react";

import { auth } from "@/lib/auth";

/**
 * Request-scoped session lookup for React Server Components.
 *
 * The proxy still validates every request independently. This only prevents a
 * layout and its page from repeating the same account-status/session-revocation
 * lookup during one render, so no security state is cached across requests.
 */
export const getServerSession = cache(() => auth());
