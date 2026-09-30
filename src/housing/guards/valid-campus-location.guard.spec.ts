import { NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ValidCampusLocationGuard } from './valid-campus-location.guard';

describe('ValidCampusLocationGuard', () => {
  const repository = {
    findOne: jest.fn(),
  };
  const guard = new ValidCampusLocationGuard(repository as never);

  const contextFor = (locationId?: string) => {
    const request = { body: { locationId } };

    return {
      context: {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as ExecutionContext,
      request,
    };
  };

  beforeEach(() => {
    repository.findOne.mockReset();
  });

  it('attaches the campus ID from an existing location', async () => {
    repository.findOne.mockResolvedValue({
      id: 'location-id',
      campusId: 'campus-id',
    });
    const { context, request } = contextFor('location-id');

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.body.campusId).toBe('campus-id');
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'location-id' },
      select: ['id', 'campusId'],
    });
  });

  it('rejects a location that does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor('location-id').context)).rejects.toThrow(
      new NotFoundException('Campus location not found'),
    );
  });
});
