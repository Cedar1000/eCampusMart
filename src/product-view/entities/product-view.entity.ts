import { BaseEntity } from 'src/common/base.entity';
import { Column, Entity } from 'typeorm';

@Entity()
export class ProductView extends BaseEntity {
  @Column()
  userId: string;

  @Column()
  productId: string;
}
