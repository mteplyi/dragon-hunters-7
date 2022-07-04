import { FSM } from './fsm';
import { delay } from './utils';
import { task } from './task';

const process: FSM.Process<{ discriminator: boolean } & Record<string, any>, number> = {
  type: 'successive',
  params: { a: 10 },
  children: [
    {
      type: 'step',
      params: {},
      run: (params, sm) => {
        return task(
          `step 1: ${JSON.stringify({ params, state: sm.get() })}`,
        );
      },
    },

    {
      type: 'step',
      run: (params, sm) => {
        sm.set(sm.get() + 2);
        return task(
          `step 2.2: ${JSON.stringify({ params, state: sm.get() })}`,
        );
      },
    },

    {
      type: 'parallel',
      params: { a: 1, b: 1 },
      children: [
        {
          type: 'step',
          params: { b: 2 },
          run: async (params, sm) => {
            await task('step 3.0');
            sm.set(sm.get() * 4);
            return task(
              `step 3.1: ${JSON.stringify(
                { params, state: sm.get() })}`,
            );
          },
        },
        {
          type: 'step',
          params: { c: 3 },
          run: async (params, sm) => {
            await task('step 3.1');
            sm.set(sm.get() ** 4);
            return task(
              `step 4.1: ${JSON.stringify(
                { params, state: sm.get() })}`,
            );
          },
        },
      ],
    },

    {
      type: 'if',
      condition: (params, sm) =>
        sm.get() > Math.random() * 128,
      then: {
        type: 'step',
        run: (params, sm) => {
          sm.set(1);
          return task(
            `step 4.0: ${JSON.stringify(
              { params, state: sm.get() },
            )}`,
          );
        },
      },
      else: {
        type: 'step',
        run: (params, sm) => {
          sm.set(0);
          return task(
            `step 4.1: ${JSON.stringify(
              { params, state: sm.get() })
            }`,
          );
        },
      },
    },

    {
      type: 'if',
      condition: Promise.resolve(false),
      then: {
        type: 'step',
        run: (params, sm) => {
          return task(
            `step 5: ${JSON.stringify({ params, state: sm.get() })}`,
          );
        },
      },
    },

    {
      type: 'if',
      params: { discriminator: true },
      condition: async (params) => {
        await delay(100);
        return params.discriminator;
      },
      then: {
        type: 'step',
        run: (params, sm) => {
          return task(
            `step 6: ${JSON.stringify({ params, state: sm.get() })}`,
          );
        },
      },
    },
  ],
};

(async () => {
  const fsm = new FSM({ state: 0 });

  const processResult = await fsm.run(process, { discriminator: false });

  console.log({
    processResult,
    stateManagerState: fsm.stateManager.get(),
  });

  fsm.stateManager.set(Math.random() * 0x0200);

  console.log({ state: fsm.stateManager.get() });

  await fsm.run({
    type: 'if',
    condition: (params, sm) => sm.get() <= 0x00ff,
    then: (params, sm) => sm.set(0),
    else: (params, sm) => sm.set(sm.get() / 2),
  });

  console.log({ state: fsm.stateManager.get() });
})();
