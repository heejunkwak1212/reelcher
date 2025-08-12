import { ApifyClient } from 'apify-client'

export type ApifyRunOptions = {
  actorId: string
  input: unknown
  token: string
}

export type ApifyRunMeta = {
  runId?: string
  datasetId?: string
  status?: string
  logUrl?: string
}

function createClient(token: string) {
  return new ApifyClient({ token })
}

export async function runActorAndGetItems<T>(options: ApifyRunOptions): Promise<T[]> {
  const { actorId, input, token } = options
  const client = createClient(token)
  const run = await client.actor(actorId).call(input as Record<string, unknown>)
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ clean: true })
  return (items as unknown[]) as T[]
}

export async function runActorAndGetItemsWithMeta<T>(options: ApifyRunOptions): Promise<{ items: T[]; meta: ApifyRunMeta }> {
  const { actorId, input, token } = options
  const client = createClient(token)
  const run = await client.actor(actorId).call(input as Record<string, unknown>)
  const meta: ApifyRunMeta = {
    runId: run.id,
    datasetId: run.defaultDatasetId,
    status: run.status,
  }
  if (!run.defaultDatasetId) return { items: [], meta }
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ clean: true })
  return { items: (items as unknown[]) as T[], meta }
}

export type ApifyTaskOptions = {
  taskId: string
  input: unknown
  token: string
}

export async function runTaskAndGetItems<T>(options: ApifyTaskOptions): Promise<T[]> {
  const { taskId, input, token } = options
  const client = createClient(token)
  const run = await client.task(taskId).call(input as Record<string, unknown>)
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ clean: true })
  return (items as unknown[]) as T[]
}

export async function runTaskAndGetItemsWithMeta<T>(options: ApifyTaskOptions): Promise<{ items: T[]; meta: ApifyRunMeta }> {
  const { taskId, input, token } = options
  const client = createClient(token)
  const run = await client.task(taskId).call(input as Record<string, unknown>)
  const meta: ApifyRunMeta = { runId: run.id, datasetId: run.defaultDatasetId, status: run.status }
  if (!run.defaultDatasetId) return { items: [], meta }
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ clean: true })
  return { items: (items as unknown[]) as T[], meta }
}

// Advanced control: start → wait → abort
export type StartTaskOptions = {
  taskId: string
  input: unknown
  token: string
}

export async function startTaskRun(options: StartTaskOptions): Promise<{ runId: string }> {
  const { taskId, input, token } = options
  const client = createClient(token)
  const run = await client.task(taskId).start(input as Record<string, unknown>)
  return { runId: run.id as string }
}

export async function waitForRunItems<T>(options: { token: string; runId: string }): Promise<{ items: T[]; meta: ApifyRunMeta }> {
  const { token, runId } = options
  const client = createClient(token)
  const finished = await client.run(runId).waitForFinish()
  const meta: ApifyRunMeta = { runId: finished.id, datasetId: finished.defaultDatasetId, status: finished.status }
  if (!finished.defaultDatasetId) return { items: [], meta }
  const { items } = await client.dataset(finished.defaultDatasetId).listItems({ clean: true })
  return { items: (items as unknown[]) as T[], meta }
}

export async function abortRun(options: { token: string; runId: string }): Promise<void> {
  const { token, runId } = options
  const client = createClient(token)
  try {
    await client.run(runId).abort()
  } catch {
    // swallow errors; best-effort abort
  }
}

