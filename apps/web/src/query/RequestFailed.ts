class RequestFailed extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
  ) {
    super(`${path} answered ${status.toString()}`);
    this.name = 'RequestFailed';
  }
}

export { RequestFailed };
