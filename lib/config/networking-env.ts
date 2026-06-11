import { VpcModuleProps } from '../modules/vpc/main';

export const getVpcModulePropsFromEnv = (env: NodeJS.ProcessEnv = process.env): VpcModuleProps => {
  const { 
    SKORIFY_VPC_NAME, 
    SKORIFY_VPC_CIDR, 
    SKORIFY_PRIVATE_SUBNET_CIDRS,
    SKORIFY_PUBLIC_SUBNET_CIDRS 
  } = env;
  
  if (!SKORIFY_VPC_NAME || !SKORIFY_VPC_CIDR) {
    throw new Error('Missing required environment variables: SKORIFY_VPC_NAME or SKORIFY_VPC_CIDR');
  }

  return {
  vpcName: SKORIFY_VPC_NAME.trim(),
  cidr: SKORIFY_VPC_CIDR.trim(),
  privateSubnetCidrs: SKORIFY_PRIVATE_SUBNET_CIDRS
    ?.split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0),
  publicSubnetCidrs: SKORIFY_PUBLIC_SUBNET_CIDRS
    ?.split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0),
};
};
