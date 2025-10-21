'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Title2,
  makeStyles,
  tokens,
  shorthands,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Button,
} from '@fluentui/react-components';
import {
  ToolboxFilled,
  SearchSquareRegular,
  LocationRegular,
  ArrowSyncRegular,
} from '@fluentui/react-icons';

// =======================
// 🔹 Brand Colors
// =======================
export const CUSTOM_BRAND_GREEN = '#8DC63F';
export const CUSTOM_BRAND_GREEN_LIGHT = '#A5E668';
export const CUSTOM_BRAND_GREEN_DARK = '#76AA37';
export const CUSTOM_ACTIVE_COLOR = '#004578'; // SharePoint deep blue highlight

// =======================
// 🔹 Constants
// =======================
const LOGO_PATH = '/photoDagm3.png';
const LOGO_HEIGHT = '40px';
const MOBILE_BREAKPOINT = '600px';

// =======================
// 🔹 Styles
// =======================
const useHeaderStyles = makeStyles({
  headerBar: {
    width: '100%',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundImage: `linear-gradient(90deg, ${CUSTOM_BRAND_GREEN} 0%, ${CUSTOM_BRAND_GREEN_LIGHT} 100%)`,
    color: tokens.colorNeutralForegroundInverted,
    boxShadow: tokens.shadow16,
    ...shorthands.borderBottom('1px', 'solid', CUSTOM_BRAND_GREEN_DARK),
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalXXXL),

    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,

    [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
      ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    },
  },

  logo: {
    height: LOGO_HEIGHT,
    objectFit: 'contain',
    marginRight: tokens.spacingHorizontalS,
    [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
      height: '32px',
    },
  },

  titleText: {
    color: tokens.colorNeutralForegroundInverted,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: '50px',

    [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
      '& span': { display: 'none' },
      ...shorthands.gap('0', '0'),
    },
  },

  linkButton: {
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForegroundInverted,
    fontWeight: tokens.fontWeightSemibold,
    ...shorthands.border('none'),
    flexShrink: 0,

    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
  },

  // 🔹 Active menu item style
  activeMenuItem: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: CUSTOM_ACTIVE_COLOR,
    fontWeight: tokens.fontWeightBold,
    borderLeft: `3px solid ${CUSTOM_ACTIVE_COLOR}`,
    ...shorthands.padding('4px', '8px'),
  },
});

// =======================
// 🔹 Component
// =======================
export interface AppHeaderProps {}

export const AppHeader: React.FC<AppHeaderProps> = () => {
  const styles = useHeaderStyles();
  const pathname = usePathname();

  return (
    <header className={styles.headerBar}>
      {/* --- Logo & Title --- */}
      <Title2 className={styles.titleText}>
        <img
          src={LOGO_PATH}
          alt="Baran Logo"
          className={styles.logo}
          style={{ minWidth: LOGO_HEIGHT }}
        />
        <span>| 🗺️ Proximity Analysis Dashboard</span>
      </Title2>

      {/* --- Tools Menu --- */}
      <Menu positioning="below-end">
        <MenuTrigger disableButtonEnhancement>
          <Button
            appearance="transparent"
            icon={<ToolboxFilled />}
            className={styles.linkButton}
          >
            Tools
          </Button>
        </MenuTrigger>

        <MenuPopover>
          <MenuList>
            <Link href="/complete" >
              <MenuItem
                icon={<ArrowSyncRegular />}
                className={pathname === '/complete' ? styles.activeMenuItem : undefined}
              >
                Batch Process (Run on File Results)
              </MenuItem>
            </Link>

            <Link href="/cordinate" >
              <MenuItem
                icon={<SearchSquareRegular />}
                className={pathname === '/cordinate' ? styles.activeMenuItem : undefined}
              >
                Single: Find Lat/Lon
              </MenuItem>
            </Link>

            <Link href="/" >
              <MenuItem
                icon={<LocationRegular />}
                className={pathname === '/' ? styles.activeMenuItem : undefined}
              >
                Single: Run Proximity Check
              </MenuItem>
            </Link>
          </MenuList>
        </MenuPopover>
      </Menu>
    </header>
  );
};
