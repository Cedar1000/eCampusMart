import sendEmail from 'utils/sendEmail';
import { User } from 'src/auth/entities/user.entity';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { ServiceStore } from './entities/service-store.entity';
import { dueReminder, FreePlanReminderSweep } from './free-plan-reminder.sweep';

jest.mock('utils/sendEmail');

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

describe('FreePlanReminderSweep', () => {
  let store: Partial<ServiceStore>;
  let onPlan: boolean;
  let sweep: FreePlanReminderSweep;
  // When the sweep runs, so the fake query applies the same date window
  let runningAt: Date;
  const now = new Date('2026-10-22T09:00:00.000Z');

  // Runs the sweep at a time relative to the free plan's end
  const runAt = (beforeEnd: number) => {
    runningAt = new Date(store.trialEndsAt!.getTime() - beforeEnd);
    return sweep.sweep(runningAt);
  };

  const sentSubjects = () =>
    jest.mocked(sendEmail).mock.calls.map(([email]) => email.subject);

  beforeEach(() => {
    jest.mocked(sendEmail).mockReset();
    onPlan = false;

    store = {
      id: 'store-1',
      name: 'Ada Cuts',
      ownerId: 'owner-1',
      createdAt: new Date(now.getTime() - 27 * DAY),
      trialEndsAt: new Date(now.getTime() + 3 * DAY),
      trialCancelled: false,
      trialReminderSent: null,
    };

    // Applies the query's date window, so plans far from their end aren't returned
    const inWindow = (at: Date) => {
      const end = store.trialEndsAt!.getTime();
      return end >= at.getTime() - DAY && end <= at.getTime() + 3 * DAY;
    };

    const manager = {
      find: jest.fn((entity: unknown) => {
        if (entity === ServiceStore) {
          return !store.trialCancelled && inWindow(runningAt)
            ? [{ ...store }]
            : [];
        }
        if (entity === Subscription) {
          return onPlan ? [{ storeId: 'store-1' }] : [];
        }
        if (entity === User) {
          return [
            { id: 'owner-1', email: 'ada@example.com', firstName: 'Ada' },
          ];
        }
        return [];
      }),
      update: jest.fn((_entity: unknown, _id: string, changes: object) =>
        Object.assign(store, changes),
      ),
    };

    sweep = new FreePlanReminderSweep({ manager } as never);
  });

  it('works out which reminder is due', () => {
    const end = new Date(now.getTime() + 2 * DAY);

    expect(dueReminder(end, now)).toBe('3d');
    expect(dueReminder(end, new Date(end.getTime() - 12 * HOUR))).toBe('1d');
    expect(dueReminder(end, new Date(end.getTime() + HOUR))).toBe('ended');
  });

  it('sends the 3 day, 1 day and ended reminders once each', async () => {
    await runAt(3 * DAY - HOUR);
    await runAt(3 * DAY - 2 * HOUR);
    await runAt(DAY - HOUR);
    await runAt(DAY - 2 * HOUR);
    await runAt(-HOUR);
    await runAt(-2 * HOUR);

    expect(sentSubjects()).toEqual([
      'Your free plan ends in 3 days',
      'Your free plan ends tomorrow',
      'Your free plan has ended',
    ]);
    expect(store.trialReminderSent).toBe('ended');

    const [first] = jest.mocked(sendEmail).mock.calls[0];
    expect(first.to).toBe('ada@example.com');
    expect(first.text).toContain('Dear Ada');
    expect(first.text).toContain('Ada Cuts');
    expect(first.text).toContain('Subscribe to a plan');
  });

  it('skips a reminder that was missed and sends the current one', async () => {
    await runAt(DAY - HOUR);

    expect(sentSubjects()).toEqual(['Your free plan ends tomorrow']);
  });

  it.each([
    ['the store subscribed', () => (onPlan = true)],
    ['the free plan was cancelled', () => (store.trialCancelled = true)],
    [
      'the store never started a free plan',
      () => (store.createdAt = store.trialEndsAt!),
    ],
  ])("doesn't remind when %s", async (_case, arrange) => {
    arrange();

    await runAt(DAY - HOUR);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("doesn't remind about a free plan that ended long ago", async () => {
    await runAt(-5 * DAY);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('tries again on the next run when the email fails', async () => {
    jest.mocked(sendEmail).mockRejectedValueOnce(new Error('smtp down'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await runAt(DAY - HOUR);
    expect(store.trialReminderSent).toBeNull();

    await runAt(DAY - 2 * HOUR);
    expect(store.trialReminderSent).toBe('1d');
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
});
