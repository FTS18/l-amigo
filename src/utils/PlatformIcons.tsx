import React from 'react';

const getFilter = (monochrome?: boolean | 'white' | 'black', defaultFilter = 'none') => {
  if (monochrome === true || monochrome === 'white') return 'brightness(0) invert(1)';
  if (monochrome === 'black') return 'brightness(0)';
  return defaultFilter;
};

export const LeetCodeIcon: React.FC<{ size?: number; className?: string; monochrome?: boolean | 'white' | 'black' }> = ({ size = 16, className = '', monochrome = false }) => (
  <img 
    src="https://cdn.iconscout.com/icon/free/png-256/free-leetcode-3521412-2944960.png" 
    alt="LeetCode" 
    width={size} 
    height={size} 
    className={className} 
    style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', filter: getFilter(monochrome, 'drop-shadow(0px 0px 1px rgba(255,255,255,0.35))') }} 
  />
);

export const CodeforcesIcon: React.FC<{ size?: number; className?: string; monochrome?: boolean | 'white' | 'black' }> = ({ size = 16, className = '', monochrome = false }) => (
  <img 
    src="https://cdn.iconscout.com/icon/free/png-256/free-code-forces-3521352-2944796.png" 
    alt="Codeforces" 
    width={size} 
    height={size} 
    className={className} 
    style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', filter: getFilter(monochrome, 'drop-shadow(0px 0px 1px rgba(255,255,255,0.35))') }} 
  />
);

export const CodeChefIcon: React.FC<{ size?: number; className?: string; monochrome?: boolean | 'white' | 'black' }> = ({ size = 16, className = '', monochrome = false }) => (
  <svg 
    role="img" 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    className={className} 
    style={{ width: size, height: size, flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
    fill={monochrome === true || monochrome === 'white' ? '#ffffff' : monochrome === 'black' ? '#000000' : '#D2691E'}
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>CodeChef</title>
    <path d="M11.2574.0039c-.37.0101-.7353.041-1.1003.095C9.6164.153 9.0766.4236 8.482.694c-.757.3244-1.5147.6486-2.2176.7027-1.1896.3785-1.568.919-1.8925 1.3516 0 .054-.054.1079-.054.1079-.4325.865-.4873 1.73-.325 2.5952.1621.5407.3786 1.0282.5408 1.5148.3785 1.0274.7578 2.0007.92 3.1362.1622.3244.3235.7571.4316 1.1897.2704.8651.542 1.8383 1.353 2.5952l.0057-.0028c.0175.0183.0301.0387.0482.0568.0072-.0036.0141-.0063.0213-.0099l-.0213-.5849c.6489-.9733 1.5673-1.6221 2.865-1.8925.5195-.1093 1.081-.1497 1.6625-.1278a8.7733 8.7733 0 0 1 1.7988.2357c1.4599.3785 2.595 1.1358 2.6492 1.7846.0273.3549.0398.6952.0326 1.0364-.001.064-.0046.1285-.007.193l.1362.0682c.075-.0375.1424-.107.2059-.1902.0008-.001.002-.002.0028-.0028.0018-.0023.0039-.0061.0057-.0085.0396-.0536.0747-.1236.1107-.1931.0188-.0377.0372-.0866.0554-.1292.2048-.4622.362-1.1536.538-1.9635.0541-.2703.1092-.4864.1633-.7027.4326-.9733 1.0266-1.8382 1.6213-2.6492.9733-1.3518 1.8928-2.5962 1.7846-4.0561-1.784-3.4608-4.2718-4.0017-5.5695-4.272-.2163-.0541-.3233-.0539-.4856-.108-1.3382-.2433-2.4945-.3953-3.6046-.3648zm5.0428 14.3788a9.8602 9.8602 0 0 0-.0326-.9824c-.0541-.703-1.1892-1.46-2.7032-1.8386-.588-.1336-1.1764-.2142-1.7448-.2356-.539-.0137-1.0657.0248-1.5546.1277-1.2436.2704-2.2162.9193-2.811 1.8925l.0511 1.431c.6672-.3558 1.7326-.8747 3.139-.9994.0662-.0059.1368-.0059.2044-.0099.1177-.013.2667-.044.4444-.044 1.6075 0 3.2682.5336 4.8767 1.6483.039-.2744.0611-.549.071-.8234l.044.0227c.0028-.0622.0143-.1268.0156-.1888zM11.256.0578c.1239-.0034.2538.01.379.0114-.23-.0022-.4588.0026-.6871.0156.103-.0061.2046-.0242.308-.027zm.4983.0156c.6552.014 1.3255.0711 2.0387.1803-.6834-.0987-1.3646-.1671-2.0387-.1803zm-1.3147.0554c-.076.0087-.1527.0133-.2285.0241-.8168.1167-1.7742.7015-2.75 1.045.3545-.1323.7143-.2957 1.0747-.4501C9.0765.4774 9.6705.207 10.1571.1529c.0939-.0139.1886-.0133.2825-.0241zm-.2285.24c.1622 0 .3787-.0002.5409.0539-.1425-.0357-.2595-.026-.3706-.0142a1.174 1.174 0 0 1 .3166.0681c.5796 1.0012-.4264 5.2791-.6786 8.1492.1559 1.0276.3138 1.9963.4628 2.7201-.7029-1.7843-1.4067-4.921-1.5148-7.354-.054-.9733.001-1.8386.2172-2.4874C9.401.8557 9.7244.4228 10.2111.3687zm3.1361.271c-.811 2.1088-.9184 6.1092-.9725 7.3528-.054.5407-.0001 1.73.054 2.5952 0 .2163.054.4325.054.6488 0-.2163-.054-.3786-.054-.5948-.4326-3.2442-.974-7.1362.9185-10.002zm3.352.3777c-.2704 2.1628-1.4047 3.191-1.7832 5.2998-.1081 1.6762-.325 3.6222-.379 5.2984-.0541-1.6762-.0007-3.4601.2697-5.2444.2703-1.8384.8651-3.6776 1.8925-5.3538zm-10.381.433c-.3581.1194-.632.248-.8575.3805.2317-.1358.4996-.2666.8575-.3805zm.2101.1974c.2155.0025.4384.0734.6006.2357-.0067-.004-.0078-.0033-.0142-.0071.1331.0929.2666.2093.3932.3847-.2036.9673.2553 3.0317.0398 4.6694.0763 1.5485.0717 3.1804.849 4.4594-.9796-1.5107-1.176-3.4375-1.3218-5.236-.1128-1.0907-.2035-2.0969-.4642-2.9033-.144-.3047-.2684-.5745-.3833-.822-.0247-.0369-.0447-.0784-.071-.1135-.1082-.1082-.1619-.2696-.1619-.3777 0-.054.0539-.1618.108-.1618.054-.0541.1616-.0553.2157-.1094a1.013 1.013 0 0 1 .2101-.0184zm-1.3459.6133c-.0604.0201-.0923.041-.1405.061z" />
  </svg>
);

const GenericPlatformIcon: React.FC<{ letter: string; color: string; size?: number; className?: string; monochrome?: boolean | 'white' | 'black' }> = ({ letter, color, size = 16, className = '', monochrome = false }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    className={className} 
    style={{ width: size, height: size, flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="24" height="24" rx="6" fill={monochrome === true || monochrome === 'white' ? '#ffffff' : monochrome === 'black' ? '#000000' : color} />
    <text x="12" y="16" fontSize="14" fontWeight="bold" fill={monochrome ? 'rgba(0,0,0,0.5)' : '#ffffff'} textAnchor="middle" fontFamily="sans-serif">{letter}</text>
  </svg>
);

export const GfgIcon: React.FC<{ size?: number; className?: string; monochrome?: boolean | 'white' | 'black' }> = ({ size = 16, className = '', monochrome = false }) => (
  <GenericPlatformIcon letter="G" color="#2f8d46" size={size} className={className} monochrome={monochrome} />
);

export const CsesIcon: React.FC<{ size?: number; className?: string; monochrome?: boolean | 'white' | 'black' }> = ({ size = 16, className = '', monochrome = false }) => (
  <GenericPlatformIcon letter="C" color="#000000" size={size} className={className} monochrome={monochrome} />
);

export const PlatformIcon: React.FC<{ platform: string; size?: number; className?: string; monochrome?: boolean | 'white' | 'black' }> = ({ platform, size = 16, className = '', monochrome = false }) => {
  const p = platform.toLowerCase();
  if (p === 'leetcode') return <LeetCodeIcon size={size} className={className} monochrome={monochrome} />;
  if (p === 'codeforces') return <CodeforcesIcon size={size} className={className} monochrome={monochrome} />;
  if (p === 'codechef') return <CodeChefIcon size={size} className={className} monochrome={monochrome} />;
  if (p === 'gfg' || p === 'geeksforgeeks') return <GfgIcon size={size} className={className} monochrome={monochrome} />;
  if (p === 'cses') return <CsesIcon size={size} className={className} monochrome={monochrome} />;
  return null;
};
