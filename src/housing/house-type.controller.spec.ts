import { HouseTypeController } from './house-type.controller';

describe('HouseTypeController', () => {
  it('lists every house type with a label', () => {
    const { data } = new HouseTypeController().findAll();

    expect(data).toEqual(
      expect.arrayContaining([
        { value: 'self-contained', label: 'Self contained' },
        { value: 'two-bedroom', label: 'Two bedroom' },
      ]),
    );
  });
});
