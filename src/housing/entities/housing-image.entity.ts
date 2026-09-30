import { BeforeInsert, Column, Entity, ManyToOne } from 'typeorm';

import { Housing } from './housing.entity';
import { BaseEntity } from 'src/common/base.entity';
import { randomInt } from 'crypto';

@Entity()
export class HousingImage extends BaseEntity {
  @Column()
  url: string;

  @Column()
  key: string;

  @Column()
  housingId: string;

  @Column()
  listingId: string;

  @ManyToOne(() => Housing, (housing) => housing.images, {
    onDelete: 'CASCADE',
  })
  housing: Housing;

  @BeforeInsert()
  generateSlug() {
    this.listingId = `LST-${this.generateListingSegment(4)}-${this.generateListingSegment(2)}`;
  }

  private generateListingSegment(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    return Array.from(
      { length },
      () => characters[randomInt(characters.length)],
    ).join('');
  }
}
