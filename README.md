# Algorithmic Symphony

Algorithmic Symphony is an interactive, visual music playground and neural training workbench. It allows users to train deep learning models (Recurrent Neural Networks and Markov Chains) directly in their browser and combine them with advanced cloud-based musical composition models.

## Features

- **Interactive Piano Roll**: A rich, polyphonic web-based grid for drawing, playing, and managing musical sheets.
- **Client-Side Model Training**: Train Recurrent Neural Networks (RNNs) and Markov Chains on classical, jazz, or custom melodies with real-time visual training loss and state transition charts.
- **Symphonic AI Improviser**: Ask the neural model to craft initial seed melodies or perform a full musicological analysis of your composed sequences.
- **Standard Web-Audio Synthesizers**: Real-time high-fidelity polyphonic instruments built natively with Web Audio APIs.
- **MIDI Export**: Export and download custom or model-generated sequences as standard MIDI files.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Lucide icons, Recharts
- **Backend**: Node.js, Express, TypeScript (server-side proxy)
- **Audio & Models**: Web Audio API, Custom client-side RNN and Markov Sequence Generators

## Getting Started

### Prerequisites

- Node.js (version 18 or higher recommended)
- npm (Node Package Manager)

### Installation

1. Clone or download the repository.
2. Install the required dependencies:
   ```bash
   npm install
   ```

### Configuration

Create a `.env.local` file in the root directory and define the following variables:

```env
GEMINI_API_KEY="your_api_key_here"
APP_URL="http://localhost:3000"
```

*Note: The system uses the API key securely server-side to generate creative melody seeds and perform musicological reviews.*

### Running the Application

To launch both the backend server and frontend development environment, run:

```bash
npm run dev
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

### Building for Production

To compile the application and bundle the backend server for a production deployment:

```bash
npm run build
```

Then, run the compiled application:

```bash
npm run start
```
