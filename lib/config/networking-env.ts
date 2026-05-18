import { VpcModuleProps } from '../modules/vpc/main';

export const getVpcModulePropsFromEnv = (env: NodeJS.ProcessEnv = process.env): VpcModuleProps => {
  const { SKORIFY_VPC_NAME, SKORIFY_VPC_CIDR, SKORIFY_PRIVATE_SUBNET_CIDRS } = env;
  if (!SKORIFY_VPC_NAME || !SKORIFY_VPC_CIDR) throw new Error('Missing SKORIFY_VPC_NAME or SKORIFY_VPC_CIDR');
  return {
    vpcName: SKORIFY_VPC_NAME,
    cidr: SKORIFY_VPC_CIDR,
    privateSubnetCidrs: SKORIFY_PRIVATE_SUBNET_CIDRS?.split(',').map((x) => x.trim()).filter((x) => x.length > 0),
  };
};
