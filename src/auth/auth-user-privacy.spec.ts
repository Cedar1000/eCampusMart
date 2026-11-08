import { AuthService } from './auth.service';
import { User, UserRole } from './entities/user.entity';

describe('AuthService other users’ private fields', () => {
  const ada = Object.assign(new User(), {
    id: 'ada',
    firstName: 'Ada',
    lastName: 'Obi',
    photo: 'https://img/ada.jpg',
    campusId: 'campus-1',
    ratingsAverage: 4.5,
    ratingsCount: 2,
    isOnline: true,
    email: 'ada@example.com',
    phoneNumber: '8012345678',
    unreadMessages: 3,
    lastLoggedIn: new Date(),
    clerkId: 'user_123',
    role: UserRole.USER,
  });

  const unused = {} as never;
  const service = new AuthService(
    { find: jest.fn(() => [ada]), count: jest.fn(() => 1) } as never,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
  );

  const PRIVATE = [
    'email',
    'phoneNumber',
    'unreadMessages',
    'lastLoggedIn',
    'clerkId',
    'role',
  ];

  it('shows someone else only their public fields', async () => {
    const { data } = await service.getSingleUser('ada', {}, 'someone-else');

    expect(data).toMatchObject({
      id: 'ada',
      firstName: 'Ada',
      photo: 'https://img/ada.jpg',
      campusId: 'campus-1',
      ratingsAverage: 4.5,
      isOnline: true,
    });
    for (const field of PRIVATE) expect(data).not.toHaveProperty(field);
  });

  it('shows users their own row in full', async () => {
    const { data } = await service.getSingleUser('ada', {}, 'ada');

    expect(data).toMatchObject({ email: 'ada@example.com', role: 'user' });
  });

  it('hides the private fields in the user list too', async () => {
    const { data } = await service.findAll({}, 'someone-else');

    for (const field of PRIVATE) expect(data[0]).not.toHaveProperty(field);
  });
});
