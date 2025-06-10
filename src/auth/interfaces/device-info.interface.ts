import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DeviceInfo {
  @Field()
  userAgent: string;

  @Field()
  ip: string;

  @Field({ nullable: true })
  platform?: string;

  @Field({ nullable: true })
  browser?: string;
}
