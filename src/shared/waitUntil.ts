const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Checks a condition repeatedly until it holds. Used to confirm console commands, which the server runs
 * asynchronously. Returns false if it never held.
 */
export const waitUntil = async (
  check: () => Promise<boolean>,
  { attempts = 6, delayMs = 1_500 }: { attempts?: number; delayMs?: number } = {}
): Promise<boolean> => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await sleep(delayMs)
    if (await check()) return true
  }
  return false
}
