import React from 'react';

type IconName =
  | 'add'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-left-double'
  | 'chevron-right-double'
  | 'chevron-down'
  | 'dashed-square'
  | 'spinner'
  | 'search'
  | 'arrow-down'
  | 'dehaze'
  | 'close'
  | 'list-alt'
  | 'plus'
  | 'horizontal-line'
  | 'double-arrow-right'
  | 'widgets'
  | 'external-link'
  | 'arrow-drop-up'
  | 'arrow-drop-down'
  | 'menu'
  | 'post'
  | 'person'
  | 'alert-info'
  | 'alert-success'
  | 'alert-warning'
  | 'alert-error'
  | 'toggle-knob'
  | 'radio-check'
  | 'checkbox-checked'
  | 'checkbox-indeterminate'
  | 'more-vert'
  | 'quick-mail'
  | 'quick-webfex'
  | 'quick-remote-support'
  | 'quick-approval'
  | 'quick-task-notification'
  | 'quick-sms'
  | 'quick-car-comparison'
  | 'quick-it-request'
  | 'quick-partners';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

const icons: Record<
  IconName,
  {
    viewBox: string;
    path: React.ReactNode;
    fill?: string;
    stroke?: string;
  }
> = {
  add: {
    viewBox: '0 0 12 12',
    path: (
      <path
        d="M6.00195 0C6.41611 1.0305e-05 6.75188 0.335853 6.75195 0.75V5.25098H11.252C11.6662 5.25098 12.002 5.58676 12.002 6.00098C12.002 6.41519 11.6662 6.75098 11.252 6.75098H6.75195V11.252C6.75195 11.6662 6.41616 12.0019 6.00195 12.002C5.58774 12.002 5.25195 11.6662 5.25195 11.252V6.75098H0.75C0.335847 6.75091 1.81039e-08 6.41515 0 6.00098C-3.88193e-10 5.58681 0.335847 5.25105 0.75 5.25098H5.25195V0.75C5.25202 0.335847 5.58778 0 6.00195 0Z"
      />
    ),
  },
  'chevron-left': {
    viewBox: '0 0 7 13',
    path: (
      <path
        d="M6.57983 0.219482C6.28693 -0.0732253 5.81212 -0.0733489 5.51929 0.219482L0.219482 5.51929C-0.0733075 5.81212 -0.0732112 6.28694 0.219482 6.57983L5.51929 11.8796C5.81217 12.1725 6.28694 12.1725 6.57983 11.8796C6.87263 11.5867 6.87269 11.112 6.57983 10.8191L1.8103 6.04956L6.57983 1.28003C6.87273 0.987136 6.87273 0.512376 6.57983 0.219482Z"
      />
    ),
  },
  'chevron-right': {
    viewBox: '0 0 7 13',
    path: (
      <path
        d="M0.219727 0.219482C0.512634 -0.0732393 0.987437 -0.0733536 1.28027 0.219482L6.61328 5.55249C6.75382 5.69312 6.833 5.88394 6.83301 6.08276C6.833 6.28159 6.75382 6.47241 6.61328 6.61304L1.28027 11.946C0.987438 12.2389 0.512628 12.2388 0.219727 11.946C-0.0731602 11.6532 -0.0731473 11.1784 0.219727 10.8855L5.02246 6.08276L0.219727 1.28003C-0.0731667 0.987136 -0.0731667 0.512376 0.219727 0.219482Z"
      />
    ),
  },
  'chevron-left-double': {
    viewBox: '0 0 13 13',
    path: (
      <>
        <path d="M6.57983 0.219482C6.28693 -0.0732253 5.81212 -0.0733489 5.51929 0.219482L0.219482 5.51929C-0.0733075 5.81212 -0.0732112 6.28694 0.219482 6.57983L5.51929 11.8796C5.81217 12.1725 6.28694 12.1725 6.57983 11.8796C6.87263 11.5867 6.87269 11.112 6.57983 10.8191L1.8103 6.04956L6.57983 1.28003C6.87273 0.987136 6.87273 0.512376 6.57983 0.219482Z" />
        <path d="M12.5798 0.219482C12.2869 -0.0732253 11.8121 -0.0733489 11.5193 0.219482L6.21948 5.51929C5.92669 5.81212 5.92679 6.28694 6.21948 6.57983L11.5193 11.8796C11.8122 12.1725 12.2869 12.1725 12.5798 11.8796C12.8726 11.5867 12.8727 11.112 12.5798 10.8191L7.8103 6.04956L12.5798 1.28003C12.8727 0.987136 12.8727 0.512376 12.5798 0.219482Z" />
      </>
    ),
  },
  'chevron-right-double': {
    viewBox: '0 0 13 13',
    path: (
      <>
        <path d="M0.219727 0.219482C0.512634 -0.0732393 0.987437 -0.0733536 1.28027 0.219482L6.61328 5.55249C6.75382 5.69312 6.833 5.88394 6.83301 6.08276C6.833 6.28159 6.75382 6.47241 6.61328 6.61304L1.28027 11.946C0.987438 12.2389 0.512628 12.2388 0.219727 11.946C-0.0731602 11.6532 -0.0731473 11.1784 0.219727 10.8855L5.02246 6.08276L0.219727 1.28003C-0.0731667 0.987136 -0.0731667 0.512376 0.219727 0.219482Z" />
        <path d="M6.21973 0.219482C6.51263 -0.0732393 6.98744 -0.0733536 7.28027 0.219482L12.6133 5.55249C12.7538 5.69312 12.833 5.88394 12.833 6.08276C12.833 6.28159 12.7538 6.47241 12.6133 6.61304L7.28027 11.946C6.98744 12.2389 6.51263 12.2388 6.21973 11.946C5.92684 11.6532 5.92685 11.1784 6.21973 10.8855L11.0225 6.08276L6.21973 1.28003C5.92683 0.987136 5.92683 0.512376 6.21973 0.219482Z" />
      </>
    ),
  },
  'chevron-down': {
    viewBox: '0 0 18 10',
    path: (
      <path d="M17.7295 0.315918C18.1071 0.718834 18.0864 1.35133 17.6836 1.729L9.68359 9.229C9.29893 9.58947 8.70004 9.58956 8.31543 9.229L0.31543 1.729C-0.0868823 1.35121 -0.107016 0.718628 0.270508 0.315917C0.648103 -0.086764 1.28069 -0.107246 1.68359 0.270019L9 7.12842L16.3164 0.270019C16.7192 -0.107383 17.3518 -0.0865186 17.7295 0.315918Z" />
    ),
  },
  'dashed-square': {
    viewBox: '0 0 24 24',
    path: (
      <path
        d="M5 19H7.33398V21H5C3.89543 21 3 20.1046 3 19V16.667H5V19ZM14.334 21H9.66699V19H14.334V21ZM21.001 19C21.001 20.1044 20.1053 20.9997 19.001 21H16.668V19H19.001V16.667H21.001V19ZM5 14.333H3V9.66602H5V14.333ZM21.001 14.333H19.001V9.66602H21.001V14.333ZM7.33398 4.99902H5V7.33301H3V4.99902C3.00022 3.96357 3.78736 3.11201 4.7959 3.00977L5 2.99902H7.33398V4.99902ZM19.001 2.99902C20.1052 2.99929 21.0007 3.89481 21.001 4.99902V7.33301H19.001V4.99902H16.668V2.99902H19.001ZM14.334 4.99902H9.66699V2.99902H14.334V4.99902Z"
      />
    ),
  },
  spinner: {
    viewBox: '0 0 24 24',
    path: (
      <path
        d="M10.0498 2.19312C11.9894 1.80735 14.0001 2.00472 15.8271 2.76147C17.6542 3.51833 19.2157 4.80074 20.3145 6.44507C21.4131 8.08943 22 10.0231 22 12.0007H20V11.9998C20 10.2863 19.4593 8.69991 18.542 7.39819C17.453 5.93321 15.822 4.85213 14.0001 4.34348V4.34326C12.9331 4.05396 11.8141 4.00171 10.7373 4.09937C10.7043 4.10464 10.6716 4.11223 10.6387 4.11792C10.4984 4.14197 10.3593 4.1687 10.2217 4.19995C9.36622 4.406 8.66047 4.69127 8.01172 5.06519C6.24063 3.6185 7.88854 2.69994 9.6875 2.27222L10.0498 2.19312Z"
        fill="currentColor"
      />
    ),
    fill: 'none',
  },
  search: {
    viewBox: '0 0 24 24',
    path: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    ),
    stroke: 'currentColor',
    fill: 'none',
  },
  'arrow-down': {
    viewBox: '0 0 24 24',
    path: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M19 9l-7 7-7-7"
      />
    ),
    stroke: 'currentColor',
    fill: 'none',
  },
  dehaze: {
    viewBox: '0 0 24 24',
    path: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M4 6h16M4 12h16M4 18h16"
      />
    ),
    stroke: 'currentColor',
    fill: 'none',
  },
  close: {
    viewBox: '0 0 24 24',
    path: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M6 18L18 6M6 6l12 12"
      />
    ),
    stroke: 'currentColor',
    fill: 'none',
  },
  'list-alt': {
    viewBox: '0 0 24 24',
    path: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    ),
    stroke: 'currentColor',
    fill: 'none',
  },
  plus: {
    viewBox: '0 0 24 24',
    path: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 4v16m8-8H4"
      />
    ),
    stroke: 'currentColor',
    fill: 'none',
  },
  'horizontal-line': {
    viewBox: '0 0 24 24',
    path: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
        d="M4 12h16"
      />
    ),
    stroke: 'currentColor',
    fill: 'none',
  },
  'double-arrow-right': {
    viewBox: '0 0 24 24',
    path: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M13 17l5-5-5-5M6 17l5-5-5-5"
      />
    ),
    stroke: 'currentColor',
    fill: 'none',
  },
  widgets: {
    viewBox: '0 0 24 24',
    path: (
      <g transform="translate(1.7, 2.1)">
        <path
          d="M8.27832 10.7227C8.83058 10.7227 9.27832 11.1704 9.27832 11.7227V16.001C9.2781 16.5531 8.83044 17.0009 8.27832 17.001H4C3.44785 17.001 3.00022 16.5531 3 16.001V11.7227C3 11.1704 3.44772 10.7227 4 10.7227H8.27832ZM16.126 10.7227C16.6783 10.7227 17.126 11.1704 17.126 11.7227V16.001C17.1258 16.5531 16.6781 17.001 16.126 17.001H11.8477C11.2956 17.0009 10.8479 16.553 10.8477 16.001V11.7227C10.8477 11.1704 11.2954 10.7227 11.8477 10.7227H16.126ZM13.2803 2.79688C13.6708 2.40663 14.3039 2.40644 14.6943 2.79688L17.5957 5.69922C17.9862 6.08974 17.9862 6.72276 17.5957 7.11328L14.6943 10.0156C14.3039 10.4059 13.6708 10.4057 13.2803 10.0156L10.3779 7.11328C9.98743 6.72278 9.98748 6.08975 10.3779 5.69922L13.2803 2.79688ZM8.27832 2.87402C8.83042 2.87406 9.27807 3.32197 9.27832 3.87402V8.15234C9.27832 8.70461 8.83058 9.15231 8.27832 9.15234H4C3.44772 9.15234 3 8.70463 3 8.15234V3.87402C3.00025 3.32195 3.44787 2.87402 4 2.87402H8.27832Z"
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </g>
    ),
  },
  'external-link': {
    viewBox: '0 0 24 24',
    path: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    ),
    stroke: 'currentColor',
    fill: 'none',
  },
  'arrow-drop-up': {
    viewBox: '0 0 24 24',
    path: <path d="M7 14l5-5 5 5z" />,
    fill: 'currentColor',
  },
  'arrow-drop-down': {
    viewBox: '0 0 24 24',
    path: <path d="M7 10l5 5 5-5z" />,
    fill: 'currentColor',
  },
  menu: {
    viewBox: '0 0 20 20',
    path: (
      <path d="M15 3C16.1046 3 17 3.89543 17 5V15C17 16.0357 16.2128 16.887 15.2041 16.9893L15 17H5L4.7959 16.9893C3.85435 16.8938 3.1062 16.1457 3.01074 15.2041L3 15V5C3 3.89543 3.89543 3 5 3H15ZM5 4.75C4.86193 4.75 4.75 4.86193 4.75 5V15C4.75 15.1381 4.86193 15.25 5 15.25H15C15.1381 15.25 15.25 15.1381 15.25 15V5C15.25 4.86193 15.1381 4.75 15 4.75H5ZM6.875 12.125C7.35825 12.125 7.75 12.5168 7.75 13C7.75 13.4832 7.35825 13.875 6.875 13.875C6.39175 13.875 6 13.4832 6 13C6 12.5168 6.39175 12.125 6.875 12.125ZM13 12.125C13.4832 12.125 13.875 12.5168 13.875 13C13.875 13.4832 13.4832 13.875 13 13.875H9.5C9.01675 13.875 8.625 13.4832 8.625 13C8.625 12.5168 9.01675 12.125 9.5 12.125H13ZM6.875 9.125C7.35825 9.125 7.75 9.51675 7.75 10C7.75 10.4832 7.35825 10.875 6.875 10.875C6.39175 10.875 6 10.4832 6 10C6 9.51675 6.39175 9.125 6.875 9.125ZM13 9.125C13.4832 9.125 13.875 9.51675 13.875 10C13.875 10.4832 13.4832 10.875 13 10.875H9.5C9.01675 10.875 8.625 10.4832 8.625 10C8.625 9.51675 9.01675 9.125 9.5 9.125H13ZM6.875 6.125C7.35825 6.125 7.75 6.51675 7.75 7C7.75 7.48325 7.35825 7.875 6.875 7.875C6.39175 7.875 6 7.48325 6 7C6 6.51675 6.39175 6.125 6.875 6.125ZM13 6.125C13.4832 6.125 13.875 6.51675 13.875 7C13.875 7.48325 13.4832 7.875 13 7.875H9.5C9.01675 7.875 8.625 7.48325 8.625 7C8.625 6.51675 9.01675 6.125 9.5 6.125H13Z" />
    ),
    fill: 'currentColor',
  },
  post: {
    viewBox: '0 0 20 20',
    path: (
      <path d="M11.6846 2.00488C11.9135 2.0276 12.1289 2.12886 12.293 2.29297L15.707 5.70703C15.8945 5.89453 16 6.1489 16 6.41406V16L15.9893 16.2041C15.8938 17.1457 15.1457 17.8938 14.2041 17.9893L14 18H6C4.89543 18 4 17.1046 4 16V4C4 2.89543 4.89543 2 6 2H11.5859L11.6846 2.00488ZM6 3.75C5.86193 3.75 5.75 3.86193 5.75 4V16C5.75 16.1381 5.86193 16.25 6 16.25H14C14.1381 16.25 14.25 16.1381 14.25 16V7.875H11C10.5168 7.875 10.125 7.48325 10.125 7V3.75H6ZM12 13.125C12.4832 13.125 12.875 13.5168 12.875 14C12.875 14.4832 12.4832 14.875 12 14.875H8C7.51675 14.875 7.125 14.4832 7.125 14C7.125 13.5168 7.51675 13.125 8 13.125H12ZM12 10.125C12.4832 10.125 12.875 10.5168 12.875 11C12.875 11.4832 12.4832 11.875 12 11.875H8C7.51675 11.875 7.125 11.4832 7.125 11C7.125 10.5168 7.51675 10.125 8 10.125H12Z" />
    ),
    fill: 'currentColor',
  },
  person: {
    viewBox: '0 0 20 20',
    path: (
      <path d="M12.0938 10.0068C14.8054 10.1439 16.9654 12.3794 16.9775 15.125C16.9892 16.0925 16.2574 16.894 15.3154 16.9902L15.125 17H4.91992C3.88089 16.9997 3.035 16.164 3.02246 15.125C3.00998 12.2982 5.2982 10 8.125 10H11.8301L12.0938 10.0068ZM8.125 11.75C6.27231 11.75 4.77172 13.2526 4.77246 15.1035C4.77344 15.1843 4.83915 15.2497 4.91992 15.25H15.125C15.182 15.2499 15.228 15.2034 15.2275 15.1465V15.1328C15.2193 13.2623 13.7006 11.7502 11.8301 11.75H8.125ZM10.1797 2.00488C12.0292 2.09842 13.5 3.62727 13.5 5.5C13.5 7.433 11.933 9 10 9L9.82031 8.99512C7.97097 8.90143 6.5 7.37263 6.5 5.5C6.5 3.5671 8.06714 2.00016 10 2L10.1797 2.00488ZM10 3.75C9.03364 3.75016 8.25 4.5336 8.25 5.5C8.25 6.4664 9.03364 7.24984 10 7.25C10.9665 7.25 11.75 6.4665 11.75 5.5C11.75 4.5335 10.9665 3.75 10 3.75Z" />
    ),
    fill: 'currentColor',
  },
  'alert-info': {
    viewBox: '0 0 20 20',
    path: (
      <path
        d="M10 2C14.4183 2 18 5.58172 18 10C18 14.4183 14.4183 18 10 18C5.58172 18 2 14.4183 2 10C2 5.58172 5.58172 2 10 2ZM10 8.25C9.51675 8.25 9.125 8.64175 9.125 9.125V13.125C9.125 13.6082 9.51675 14 10 14C10.4832 14 10.875 13.6082 10.875 13.125V9.125C10.875 8.64175 10.4832 8.25 10 8.25ZM10 5.625C9.51675 5.625 9.125 6.01675 9.125 6.5C9.125 6.98325 9.51675 7.375 10 7.375C10.4832 7.375 10.875 6.98325 10.875 6.5C10.875 6.01675 10.4832 5.625 10 5.625Z"
        fill="#0288D1"
      />
    ),
  },
  'alert-success': {
    viewBox: '0 0 20 20',
    path: (
      <path
        d="M10 2C14.4183 2 18 5.58172 18 10C18 14.4183 14.4183 18 10 18C5.58172 18 2 14.4183 2 10C2 5.58172 5.58172 2 10 2ZM13.6191 7.38086C13.2774 7.03957 12.7224 7.03929 12.3809 7.38086L9 10.7617L7.61914 9.38086C7.2774 9.03957 6.72243 9.03929 6.38086 9.38086C6.03935 9.72243 6.03959 10.2774 6.38086 10.6191L8.38086 12.6191C8.72258 12.9604 9.27757 12.9606 9.61914 12.6191L13.6191 8.61914C13.9607 8.27757 13.9604 7.7226 13.6191 7.38086Z"
        fill="#2E7D32"
      />
    ),
  },
  'alert-warning': {
    viewBox: '0 0 20 20',
    path: (
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.16992 3.00974C9.55223 2.33009 10.5308 2.33009 10.9131 3.00974L18.2031 15.9697C18.578 16.6362 18.0967 17.4597 17.332 17.4599H2.75098C1.98639 17.4596 1.505 16.6362 1.87989 15.9697L9.16992 3.00974ZM10 13.625C9.51675 13.625 9.125 14.0167 9.125 14.5C9.125 14.9832 9.51675 15.375 10 15.375C10.4832 15.3749 10.875 14.9832 10.875 14.5C10.875 14.0168 10.4832 13.625 10 13.625ZM10 6.99997C9.51675 6.99997 9.125 7.39172 9.125 7.87497V11.875C9.125 12.3582 9.51675 12.75 10 12.75C10.4832 12.7499 10.875 12.3582 10.875 11.875V7.87497C10.875 7.39176 10.4832 7.00004 10 6.99997Z"
        fill="#ED6C02"
      />
    ),
  },
  'alert-error': {
    viewBox: '0 0 20 20',
    path: (
      <path
        d="M10 2C14.4183 2 18 5.58172 18 10C18 14.4183 14.4183 18 10 18C5.58172 18 2 14.4183 2 10C2 5.58172 5.58172 2 10 2ZM10 12.25C9.51675 12.25 9.125 12.6418 9.125 13.125C9.125 13.6082 9.51675 14 10 14C10.4832 14 10.875 13.6082 10.875 13.125C10.875 12.6418 10.4832 12.25 10 12.25ZM10 5.625C9.51675 5.625 9.125 6.01675 9.125 6.5V10.5C9.125 10.9832 9.51675 11.375 10 11.375C10.4832 11.375 10.875 10.9832 10.875 10.5V6.5C10.875 6.01675 10.4832 5.625 10 5.625Z"
        fill="#D32F2F"
      />
    ),
  },
  'toggle-knob': {
    viewBox: '0 0 20 21',
    path: (
      <g filter="url(#filter0_dd_toggle_knob)">
        <circle cx="10" cy="10" r="7" fill="white" />
        <defs>
          <filter
            id="filter0_dd_toggle_knob"
            x="0"
            y="0"
            width="20"
            height="21"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="2" />
            <feGaussianBlur stdDeviation="1" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.07 0"
            />
            <feBlend
              mode="normal"
              in2="BackgroundImageFix"
              result="effect1_dropShadow_toggle_knob"
            />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset />
            <feGaussianBlur stdDeviation="1.5" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0"
            />
            <feBlend
              mode="normal"
              in2="effect1_dropShadow_toggle_knob"
              result="effect2_dropShadow_toggle_knob"
            />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="effect2_dropShadow_toggle_knob"
              result="shape"
            />
          </filter>
        </defs>
      </g>
    ),
  },
  'radio-check': {
    viewBox: '0 0 10 10',
    path: <circle cx="5" cy="5" r="5" fill="currentColor" />,
  },
  'checkbox-checked': {
    viewBox: '0 0 12 9',
    path: (
      <path
        d="M1 3.76923L4.5 7L11 1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    ),
  },
  'checkbox-indeterminate': {
    viewBox: '0 0 12 2',
    path: (
      <path
        d="M1 1H11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    ),
  },
  'more-vert': {
    viewBox: '0 0 16 16',
    path: (
      <>
        <circle cx="8" cy="3" r="1.5" fill="currentColor" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        <circle cx="8" cy="13" r="1.5" fill="currentColor" />
      </>
    ),
  },
  // 바로가기 아이콘 (Quick Links)
  'quick-mail': {
    viewBox: '0 0 48 48',
    path: (
      <>
        <rect x="4" y="10" width="40" height="28" rx="3" fill="#98B3EE" />
        <path
          d="M4 15L24 28L44 15V35C44 36.6569 42.6569 38 41 38H7C5.34315 38 4 36.6569 4 35V15Z"
          fill="#0033A0"
        />
        <path
          d="M4 13C4 11.3431 5.34315 10 7 10H41C42.6569 10 44 11.3431 44 13L24 26L4 13Z"
          fill="#3E6CCF"
        />
      </>
    ),
  },
  'quick-webfex': {
    viewBox: '0 0 48 48',
    path: (
      <>
        <rect x="4" y="16" width="40" height="20" rx="3" fill="#0033A0" />
        <rect x="10" y="6" width="28" height="14" rx="2" fill="#3E6CCF" />
        <rect x="10" y="32" width="28" height="10" rx="1" fill="#FFFFFF" />
        <circle cx="38" cy="24" r="3" fill="#FBBC04" />
        <rect x="14" y="35" width="20" height="2" fill="#DEE2E6" />
        <rect x="14" y="39" width="14" height="2" fill="#DEE2E6" />
      </>
    ),
  },
  'quick-remote-support': {
    viewBox: '0 0 48 48',
    path: (
      <>
        <rect x="6" y="12" width="36" height="24" rx="2" fill="#0033A0" />
        <rect x="9" y="15" width="30" height="18" rx="1" fill="#3E6CCF" />
        <rect x="20" y="36" width="8" height="4" fill="#98B3EE" />
        <rect x="16" y="40" width="16" height="3" rx="1" fill="#98B3EE" />
        <path
          d="M18 22C18 18.6863 20.6863 16 24 16C27.3137 16 30 18.6863 30 22"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M21 22C21 20.3431 22.3431 19 24 19C25.6569 19 27 20.3431 27 22"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="24" cy="24" r="2" fill="#FBBC04" />
      </>
    ),
  },
  'quick-approval': {
    viewBox: '0 0 48 48',
    path: (
      <>
        <rect x="8" y="4" width="26" height="34" rx="2" fill="#3E6CCF" />
        <rect x="10" y="6" width="22" height="30" rx="1" fill="#FFFFFF" />
        <rect x="13" y="10" width="16" height="2" rx="1" fill="#98B3EE" />
        <rect x="13" y="15" width="12" height="2" rx="1" fill="#98B3EE" />
        <rect x="13" y="20" width="14" height="2" rx="1" fill="#98B3EE" />
        <rect x="13" y="25" width="10" height="2" rx="1" fill="#98B3EE" />
        <rect x="30" y="26" width="10" height="6" rx="1" fill="#0033A0" />
        <rect x="28" y="32" width="14" height="12" rx="2" fill="#0033A0" />
        <ellipse cx="35" cy="42" rx="5" ry="2" fill="#FBBC04" />
      </>
    ),
  },
  'quick-task-notification': {
    viewBox: '0 0 48 48',
    path: (
      <>
        <rect x="6" y="16" width="28" height="22" rx="3" fill="#0033A0" />
        <path
          d="M14 16V12C14 10.3431 15.3431 9 17 9H23C24.6569 9 26 10.3431 26 12V16"
          stroke="#0033A0"
          strokeWidth="3"
          fill="none"
        />
        <rect x="17" y="22" width="6" height="4" rx="1" fill="#3E6CCF" />
        <path
          d="M38 14C35.2386 14 33 16.2386 33 19V26C33 27.1046 32.1046 28 31 28H45C43.8954 28 43 27.1046 43 26V19C43 16.2386 40.7614 14 38 14Z"
          fill="#FBBC04"
        />
        <circle cx="38" cy="31" r="2" fill="#FBBC04" />
        <rect x="36" y="10" width="4" height="4" rx="2" fill="#FBBC04" />
      </>
    ),
  },
  'quick-sms': {
    viewBox: '0 0 48 48',
    path: (
      <>
        <rect x="8" y="4" width="22" height="40" rx="3" fill="#3E6CCF" />
        <rect x="10" y="8" width="18" height="32" rx="1" fill="#FFFFFF" />
        <circle cx="19" cy="42" r="2" fill="#98B3EE" />
        <path
          d="M28 16H42C43.1046 16 44 16.8954 44 18V30C44 31.1046 43.1046 32 42 32H36L32 36V32H28C26.8954 32 26 31.1046 26 30V18C26 16.8954 26.8954 16 28 16Z"
          fill="#FBBC04"
        />
        <circle cx="32" cy="24" r="1.5" fill="#913F02" />
        <circle cx="35" cy="24" r="1.5" fill="#913F02" />
        <circle cx="38" cy="24" r="1.5" fill="#913F02" />
      </>
    ),
  },
  'quick-car-comparison': {
    viewBox: '0 0 48 48',
    path: (
      <>
        <rect x="4" y="4" width="24" height="30" rx="2" fill="#3E6CCF" />
        <rect x="6" y="6" width="20" height="26" rx="1" fill="#FFFFFF" />
        <rect x="9" y="10" width="14" height="2" rx="1" fill="#98B3EE" />
        <rect x="9" y="15" width="10" height="2" rx="1" fill="#98B3EE" />
        <rect x="9" y="20" width="12" height="2" rx="1" fill="#98B3EE" />
        <rect x="9" y="25" width="8" height="2" rx="1" fill="#98B3EE" />
        <path
          d="M26 34L28 30H40L42 34V38C42 39.1046 41.1046 40 40 40H28C26.8954 40 26 39.1046 26 38V34Z"
          fill="#0033A0"
        />
        <path d="M28 34L29.5 30H38.5L40 34H28Z" fill="#3E6CCF" />
        <circle cx="30" cy="40" r="2.5" fill="#212529" />
        <circle cx="38" cy="40" r="2.5" fill="#212529" />
        <circle cx="30" cy="40" r="1" fill="#98B3EE" />
        <circle cx="38" cy="40" r="1" fill="#98B3EE" />
      </>
    ),
  },
  'quick-it-request': {
    viewBox: '0 0 48 48',
    path: (
      <>
        <rect x="6" y="4" width="26" height="34" rx="2" fill="#3E6CCF" />
        <rect x="8" y="6" width="22" height="30" rx="1" fill="#FFFFFF" />
        <rect x="11" y="10" width="16" height="2" rx="1" fill="#98B3EE" />
        <rect x="11" y="15" width="12" height="2" rx="1" fill="#98B3EE" />
        <rect x="11" y="20" width="14" height="2" rx="1" fill="#98B3EE" />
        <rect x="11" y="25" width="10" height="2" rx="1" fill="#98B3EE" />
        <circle cx="36" cy="34" r="10" fill="#0033A0" />
        <circle cx="36" cy="34" r="7" fill="#3E6CCF" />
        <rect x="34" y="30" width="4" height="6" rx="1" fill="#FFFFFF" />
        <circle cx="36" cy="39" r="1.5" fill="#FFFFFF" />
      </>
    ),
  },
  'quick-partners': {
    viewBox: '0 0 48 48',
    path: (
      <>
        <rect x="4" y="10" width="40" height="28" rx="2" fill="#3E6CCF" />
        <rect x="6" y="12" width="36" height="24" rx="1" fill="#FFFFFF" />
        <ellipse cx="18" cy="28" rx="6" ry="6" fill="#98B3EE" />
        <ellipse cx="30" cy="28" rx="6" ry="6" fill="#98B3EE" />
        <path
          d="M18 26L21 28L18 30"
          stroke="#0033A0"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M30 26L27 28L30 30"
          stroke="#0033A0"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M21 28H27"
          stroke="#0033A0"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
};

export const Icon = ({ name, size = 24, className, ...props }: IconProps) => {
  const icon = icons[name];

  if (!icon) {
    // eslint-disable-next-line no-console
    console.error(`Icon "${name}" not found.`);
    return null;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={icon.viewBox}
      fill={icon.fill ?? 'currentColor'}
      stroke={icon.stroke}
      className={className}
      {...props}
    >
      {icon.path}
    </svg>
  );
};