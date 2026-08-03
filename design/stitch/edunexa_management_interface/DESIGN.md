---
name: EduNexa Management Interface
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#464554'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#6b38d4'
  on-secondary: '#ffffff'
  secondary-container: '#8455ef'
  on-secondary-container: '#fffbff'
  tertiary: '#006c49'
  on-tertiary: '#ffffff'
  tertiary-container: '#00885d'
  on-tertiary-container: '#000703'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  title-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 32px
  gutter: 24px
  sidebar-width: 280px
  card-gap: 24px
---

## Brand & Style
The design system embodies a premium, high-performance atmosphere for modern educational institutions. It blends the structural clarity of enterprise software with the refined aesthetics of high-end consumer technology.

The visual direction is a fusion of **Corporate Modern** and **Glassmorphism**. It prioritizes extreme legibility and spaciousness, utilizing soft 3D depth and subtle translucent layers to create a sense of hierarchy without clutter. Surfaces are treated with precision, featuring microscopic borders and multi-layered shadows that mimic physical objects resting on a soft-lit plane. The emotional response is one of institutional reliability coupled with cutting-edge innovation.

## Colors
This design system utilizes a sophisticated palette centered on Indigo and Violet to signify intelligence and creativity.

- **Primary & Secondary:** Used for "Primary Glowing Gradients." These should be applied to high-impact actions and active states.
- **Surface Strategy:** In Light Mode, the system uses a cool-toned gray-blue background to make white cards "pop." In Dark Mode, deep navy-blacks provide high contrast for vibrant text.
- **Semantic Accents:** Success, Warning, and Danger colors are used sparingly for status indicators, ensuring they do not compete with the primary brand colors.
- **Glassmorphism:** Use 60% opacity on surface colors with a 20px backdrop blur for overlays, modals, and navigation bars.

## Typography
The system uses **Geist** for its technical precision and modern character. 

- **Hierarchy:** Large display titles drive the "Linear" aesthetic, providing clear entry points for pages. 
- **Labels:** Small labels use increased letter spacing and a semi-bold weight for readability in data-heavy views.
- **Rendering:** Anti-aliasing should be forced for dark-mode environments to maintain the thin strokes of the Geist typeface.

## Layout & Spacing
The layout follows a **Fluid Grid** model with high-density protection.

- **The 8px Grid:** All margins and paddings are multiples of 8px.
- **Sidebar:** A floating sidebar with a 24px margin from the screen edge. On scroll, the sidebar background should utilize glassmorphism.
- **Mobile:** Transition to a 4-column grid with 16px margins. Primary navigation moves to a bottom-fixed bar with a centralized floating action button (FAB) for quick task entry (e.g., "Add Grade" or "Record Attendance").

## Elevation & Depth
This system relies on **Ambient Shadows** and **Tonal Layers** to create a premium feel.

- **Shadows:** Avoid harsh blacks. Use the primary color at 10% opacity for shadows on primary elements. Default card shadows use a 0px 4px 20px offset with 5% opacity of the neutral color.
- **Borders:** Surfaces use a 1px solid border. In light mode, use `#E2E8F0`. In dark mode, use a translucent white `rgba(255,255,255,0.08)`.
- **Hover Effects:** Interactive cards should "lift" by increasing shadow spread and reducing border opacity, creating a seamless 3D transition.

## Shapes
A **Rounded** shape language is used to soften the data-heavy nature of a management system.

- **Standard Elements:** Buttons, inputs, and badges use the 0.5rem (8px) base radius.
- **Containers:** Large cards and sidebar containers use the `rounded-xl` (1.5rem/24px) setting to create a friendly, "app-like" appearance.
- **Pills:** Status badges and active nav indicators are fully rounded (pill-shaped) to distinguish them from structural elements.

## Components

### Buttons
- **Primary:** Linear gradient from Primary to Secondary. Apply a `box-shadow` that matches the primary color to create a "glowing" effect.
- **Secondary/Ghost:** Transparent backgrounds with subtle borders that darken/lighten on hover.
- **Active Capsules:** Sidebar links use a soft gradient capsule (10% opacity of Primary) to indicate the current page.

### Form Fields & Inputs
- **Style:** Minimalist with a 1px border.
- **Focus:** Transition the border to the Primary color and add a 4px outer "halo" with 15% opacity of the Primary color.
- **Date Pickers:** Use a glassmorphic dropdown with a high-contrast selection state.

### Cards & Tables
- **Cards:** White or Deep Navy background, 1px border, and soft ambient shadow.
- **Tables:** No vertical borders. Use subtle row striping (`#F8FAFC` in light mode). Headers should be `label-sm` style for clarity.

### Feedback & Status
- **Badges:** Soft pill shapes with 10% opacity of the semantic color (Success/Warning/Danger) and 100% opacity text.
- **Toasts:** Floating glassmorphic containers at the top-right, utilizing a subtle slide-in animation.
- **Loading:** Use skeleton screens that mimic the exact layout of the cards they represent, with a shimmering gradient animation.

### Dashboard Hero
- **Visuals:** Large-scale gradients in the background. Use 3D education motifs (abstract book shapes or spheres) with a glass-like material property.