export type PageMetadata = {
  title: string;
  description: string;
};

export const pageMetadata: Record<string, PageMetadata> = {
  '/': {
    title: 'Kairov | Digital Solutions for Business',
    description:
      'We help businesses understand what is getting in the way, find the right opportunity, and use technology to make practical progress.',
  },
  '/about': {
    title: 'About Kairov | Technology Consultancy',
    description:
      'Kairov is a digital-solutions and technology consultancy. We understand business needs, identify opportunities, and implement technology that fits.',
  },
  '/services': {
    title: 'Digital Solutions and Services | Kairov',
    description:
      'From a focused improvement to a custom build, Kairov first understands your business and identifies which technology can help.',
  },
  '/case-studies-v1': {
    title: 'Kairov Case Studies | Practical Digital Solutions',
    description:
      'Explore selected examples of digital work and ideas. Each project begins with a specific question and a considered approach to solving it.',
  },
  '/contact': {
    title: 'Contact Kairov | Technology Solutions for Business',
    description:
      "Tell Kairov what you are working through, where you see an opportunity, or what you want to build. We'll start by understanding the need.",
  },
};
