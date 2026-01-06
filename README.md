# Orbit Lab

Orbit Lab is an interactive gravity playground built to explore
how small physics assumptions change large-scale system behavior.

This project focuses less on perfect physical accuracy, and more on
making complex simulation rules visible, adjustable, and explorable
in real time.

## What This Project Is (and Isn't)

This is not a scientifically exact gravity simulator.
It is a controlled simulation playground designed to expose
trade-offs between stability, realism, and interactivity.

## Features

- **Interactive Gravity Simulation**: Create stars by clicking and dragging, watch them interact through gravitational forces
- **Multiple Physics Modes**: 
  - Orbit Playground: Stable orbital mechanics with a central sun
  - N-Body Chaos: Full pairwise gravitational interactions
- **Universe Management**: 
  - Preset universes with different configurations
  - Save and load universe states
  - Switch between universes like TV channels (each maintains independent state)
- **Evolution Lab**: Genetic algorithm integration for evolving star configurations
- **Real-time Debugging**: Adjustable physics parameters with live preview
- **Visual Customization**: Configurable star rendering, trails, and visual effects

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000/motion-canvas](http://localhost:3000/motion-canvas) in your browser.

### Build

Build for production:

```bash
npm run build
npm start
```

## Project Structure

```
MotionCanvas/
├── app/
│   ├── evolution-lab/          # Genetic algorithm evolution interface
│   │   ├── page.tsx
│   │   ├── UniverseCard.tsx
│   │   └── UniverseDetail.tsx
│   ├── motion-canvas/           # Main gravity simulation interface
│   │   ├── page.tsx
│   │   ├── GravityDebugPanel.tsx
│   │   ├── UniverseBrowser.tsx
│   │   └── UniverseSelectionMenu.tsx
│   ├── layout.tsx
│   └── globals.css
│
├── lib/
│   ├── gravity/                 # Gravity simulation core
│   │   ├── config.ts           # Physics configuration
│   │   ├── gravity.ts          # Main gravity system
│   │   ├── simulation.ts       # Physics simulation engine
│   │   ├── star.ts             # Star class
│   │   ├── renderer.ts         # Canvas rendering
│   │   ├── interaction.ts      # User input handling
│   │   └── universe-presets.ts # Predefined universe configurations
│   │
│   └── constellation/           # Constellation system (legacy)
│       ├── config.ts
│       ├── types.ts
│       ├── node.ts
│       ├── connection.ts
│       ├── simulation.ts
│       ├── renderer.ts
│       ├── interaction.ts
│       └── constellation.ts
│
├── initial-universe.json        # Default universe configuration
└── package.json
```

## Usage

### Creating Stars

- **Click and Drag**: Click on the canvas and drag to create a star. The drag distance and speed determine the star's initial velocity.
- **Hold to Grow**: Hold the mouse/touch down to increase the star's mass before releasing.

### Physics Modes

#### Orbit Playground Mode
- Features a central sun with configurable mass
- Stars orbit around the sun in stable elliptical orbits
- Energy-conserving physics for long-term stability
- Ideal for observing orbital mechanics

#### N-Body Chaos Mode
- Full pairwise gravitational interactions between all stars
- Chaotic dynamics with optional damping
- More computationally intensive but visually spectacular

### Universe Management

- **Universe Selection Menu**: Choose from preset universes or load saved states
- **Save State**: Save the current universe configuration and star positions
- **Reset**: Restart the current universe with fresh initial conditions
- **Auto-save**: Universe states are automatically saved when switching between universes

### Debug Panel (Intentional Design)

The debug panel is not only for debugging bugs.

It is intentionally exposed to allow live exploration of:
- Stability vs. chaos
- Energy conservation vs. visual control
- Physical realism vs. user experience

This makes system behavior observable instead of hidden.

You can adjust:
- Physics parameters (gravity constant, damping, softening)
- Visual settings (radius scale, trail length, colors)
- Launch mechanics (flick sensitivity, mass resistance)
- Star creation limits (min/max mass, count limits)

## Configuration

Key configuration parameters are in `lib/gravity/config.ts`:

### Physics Parameters
- `GRAVITY_CONSTANT`: Gravitational constant (default: 10000)
- `VELOCITY_DAMPING`: Energy loss per frame (0 = no damping)
- `SOFTENING_EPS_PX`: Gravity softening parameter to prevent singularities
- `SUN_MASS`: Central sun mass for Orbit Playground mode

### Visual Parameters
- `RADIUS_SCALE`: Visual scaling factor for star size
- `RADIUS_POWER`: Power law for radius calculation (0.5 = area-based, 0.333 = volume-based)
- `TRAIL_LENGTH`: Number of frames to show star trails

### Interaction Parameters
- `FLICK_VMAX`: Maximum launch velocity
- `MIN_MASS` / `MAX_MASS`: Mass range for created stars
- `HOLD_TO_MAX_SECONDS`: Time to hold for maximum mass

## Evolution Lab

The Evolution Lab (`/evolution-lab`) uses genetic algorithms to evolve star configurations:
- Fitness evaluation based on orbital stability
- Population-based evolution
- Export evolved configurations to the main simulation

## Technologies

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Canvas API**: High-performance 2D rendering
- **LocalStorage**: Universe state persistence

## Development Notes

- Verlet integration is used for stability and simplicity.
  More advanced integrators were intentionally avoided
  to keep the system understandable and debuggable.

- Some non-physical options (damping, force clamping) exist
  and are explicitly labeled as such instead of being hidden.

- Star states are preserved when switching universes (like TV channels)
- Configurations can be passed via URL parameters for sharing
- The system supports both mouse and touch interactions

## License

Private project - All rights reserved
