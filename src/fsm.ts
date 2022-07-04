import { isStaticType } from './utils';

export class FSM<TParams extends FSM.Params = {}, TState = undefined> {
  private readonly params: Partial<TParams>;
  private state: TState;

  constructor (options?: { params?: Partial<TParams>; state?: TState }) {
    this.params = options?.params || {};
    this.state = options?.state as TState;
  }

  get stateManager (): FSM.StateManager<TState> {
    return {
      get: () => structuredClone(this.state),
      set: (state) => this.state = structuredClone(state),
    };
  }

  private async runSuccessiveProcess<TRunParams extends TParams> (
    process: FSM.SuccessiveProcess<Partial<TRunParams>, TState>,
    mergedParams: Partial<TRunParams>,
  ): Promise<void> {
    for (const childProcess of process.children) {
      await this.runProcess(childProcess, structuredClone(mergedParams));
    }
  }

  private async runStepProcess<TRunParams extends TParams> (
    process: FSM.StepProcess<Partial<TRunParams>, TState>,
    mergedParams: Partial<TRunParams>,
  ): Promise<void> {
    await process.run(structuredClone(mergedParams), this.stateManager);
  }

  private async runParallelProcess<TRunParams extends TParams> (
    process: FSM.ParallelProcess<Partial<TRunParams>, TState>,
    mergedParams: Partial<TRunParams>,
  ): Promise<void> {
    await Promise.all(process.children.map((childProcess) => {
      return this.runProcess(childProcess, structuredClone(mergedParams));
    }));
  }

  private async evaluateCondition<TRunParams extends TParams> (
    condition: FSM.Condition<Partial<TRunParams>, TState>,
    mergedParams: Partial<TRunParams>,
  ): Promise<boolean> {
    if (!(condition instanceof Function)) {
      return condition;
    }

    return condition(structuredClone(mergedParams), this.stateManager);
  }

  private async runConditionProcess<TRunParams extends TParams> (
    process: FSM.ConditionProcess<Partial<TRunParams>, TState>,
    mergedParams: Partial<TRunParams>,
  ): Promise<void> {
    const conditionResult = await this.evaluateCondition(
      process.condition,
      mergedParams,
    );

    const nextStep = conditionResult ? process.then : (process.else || null);

    if (!nextStep) {
      return;
    }

    if (nextStep instanceof Function) {
      await nextStep(structuredClone(mergedParams), this.stateManager);
    } else {
      await this.runProcess(nextStep, structuredClone(mergedParams));
    }
  }

  private async runProcess<TRunParams extends TParams> (
    process: FSM.Process<Partial<TRunParams>, TState>,
    params: Partial<TRunParams>,
  ): Promise<void> {
    const mergedParams = { ...params, ...process.params };

    switch (process.type) {
      case 'successive':
        return this.runSuccessiveProcess(process, mergedParams);

      case 'step':
        return this.runStepProcess(process, mergedParams);

      case 'parallel':
        return this.runParallelProcess(process, mergedParams);

      case 'if':
        return this.runConditionProcess(process, mergedParams);

      default: {
        /**
         * Static assertion that all cases are mentioned
         */
        const { type } = process;
        isStaticType<never>(type);
        throw new Error(`Unsupported process type(${type})`);
      }
    }
  }

  async run<TRunParams extends TParams> (
    process: FSM.Process<Partial<TRunParams>, TState>,
    params?: Partial<TRunParams>,
  ): Promise<TState> {
    const mergedParams = { ...this.params, ...params };
    await this.runProcess(process, mergedParams);
    return this.state;
  }
}

export namespace FSM {
  export type Params = Record<string, any>;

  interface CommonProcess<TParams> {
    params?: Partial<TParams>;
  }

  export interface SuccessiveProcess<TParams extends Params = {}, TState = undefined> extends CommonProcess<TParams> {
    type: 'successive';
    children: Process<TParams, TState>[];
  }

  export interface StepProcess<TParams extends Params = {}, TState = undefined> extends CommonProcess<TParams> {
    type: 'step';
    run: Task<TParams, TState, void>;
  }

  export interface ParallelProcess<TParams extends Params = {}, TState = undefined> extends CommonProcess<TParams> {
    type: 'parallel';
    children: Process<TParams, TState>[];
  }

  export type Condition<TParams extends Params = {}, TState = undefined> =
    | boolean
    | PromiseLike<boolean>
    | Task<TParams, TState, boolean>;

  export interface ConditionProcess<TParams extends Params = {}, TState = undefined> extends CommonProcess<TParams> {
    type: 'if';
    condition: Condition<TParams, TState>;
    then: Task<TParams, TState, void> | Process<TParams, TState>;
    else?: Task<TParams, TState, void> | Process<TParams, TState>;
  }

  export type Process<TParams extends Params = {}, TState = undefined> =
    | SuccessiveProcess<TParams, TState>
    | StepProcess<TParams, TState>
    | ParallelProcess<TParams, TState>
    | ConditionProcess<TParams, TState>;

  export type Task<TParams, TState, TReturn> = (
    params: TParams,
    stateManager: StateManager<TState>,
  ) => TReturn | PromiseLike<TReturn>

  export interface StateManager<TState> {
    get (): TState;
    set (state: TState): void;
  }
}
