/**
 * Custom IDs for buttons and modals look like "<feature>:<action>" or "<feature>:<action>:<argument>", for example
 * "whitelist:approve:3f2a1b". The first two parts pick the handler; the rest is passed to it.
 */
export class CustomId {
  static build(base: string, argument?: string): string {
    return argument ? `${base}:${argument}` : base
  }

  static parse(customId: string): { base: string; argument: string | undefined } {
    const [feature = '', action = '', ...rest] = customId.split(':')
    return { base: `${feature}:${action}`, argument: rest.length ? rest.join(':') : undefined }
  }
}
