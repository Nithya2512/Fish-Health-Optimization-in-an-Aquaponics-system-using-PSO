# Fish Health Optimization in an Aquaponics System using Particle Swarm Optimization (PSO)

A web-based aquaponics decision support system that uses **Particle Swarm Optimization (PSO)** to recommend operating conditions that improve fish health based on current water quality parameters. The application predicts the effect of different control settings and presents the results through an interactive dashboard.

---

# Project Overview

Maintaining proper water quality is essential for healthy fish growth in aquaponics systems. Parameters such as temperature, dissolved oxygen, pH, ammonia, and nitrate directly influence fish health.

This project provides a simple web interface where users can:

- Select a fish species.
- Enter the current water quality conditions.
- Specify the total fish biomass.
- Run Particle Swarm Optimization (PSO).
- View the current and predicted Fish Health Index (FHI).
- Receive recommended operating parameters.
- Compare current and predicted water quality using visual charts.

The backend combines species-specific water quality limits with mathematical prediction models and Particle Swarm Optimization to estimate improved operating conditions.

---

# Project Objective

The objective of this project is to assist aquaculture operators by recommending suitable operating parameters that can improve fish health under different water quality conditions. The system combines scientific water quality models with Particle Swarm Optimization (PSO) to estimate improved operating conditions and present the results through an interactive web interface.

---

# Features

- Supports multiple fish species
  - Tilapia
  - Trout
  - Catfish
  - Carp
  - Barramundi
  - Koi
  - Salmon
  - Pangasius

- Interactive web interface

- Fish Health Index (FHI) calculation

- Particle Swarm Optimization (PSO)

- Water quality prediction

- Recommended operating parameters:
  - Feeding Rate
  - Aeration Intensity
  - Water Exchange Rate
  - Target Water Temperature

- Current vs Predicted parameter comparison

- Fish Health Index visualization

- PSO convergence graph

- Recommended action plan

- Implementation guide

---

# Input Parameters

The application accepts the following inputs:

| Parameter | Description |
|-----------|-------------|
| Temperature | Water temperature (°C) |
| pH | Acidity/alkalinity of water |
| Dissolved Oxygen (DO) | Oxygen concentration (mg/L) |
| Ammonia (NH₃) | Ammonia concentration (mg/L) |
| Nitrate (NO₃) | Nitrate concentration (mg/L) |
| Biomass | Total fish biomass (kg) |

---

# Optimization Process

The optimization workflow is as follows:

1. Select a fish species.
2. Enter the current water quality parameters.
3. Specify the fish biomass.
4. Load species-specific parameter ranges.
5. Predict the future water quality using mathematical models.
6. Run Particle Swarm Optimization (PSO).
7. Compute the Fish Health Index before and after optimization.
8. Display optimized operating recommendations and visualizations.

---

# Output

After optimization, the application displays:

- Current Fish Health Index (FHI)
- Predicted Fish Health Index
- Recommended feeding rate
- Recommended aeration intensity
- Recommended water exchange rate
- Recommended target temperature
- Current tank conditions
- Predicted water quality
- Current vs Predicted comparison chart
- PSO convergence graph
- Suggested implementation steps

---

# 🛠️ Technologies Used

## Backend

- Python
- Flask
- NumPy

## Frontend

- HTML5
- CSS3
- JavaScript

## Libraries

- Tailwind CSS
- Chart.js
- Lucide Icons

---

# Project Structure

```text
Fish-Health-Optimization-in-an-Aquaponics-System-using-PSO
│
├── app.py
├── species_data.json
├── README.md
├── LICENSE
├── .gitignore
│
├── static
│   ├── style.css
│   └── script.js
│
└── templates
    └── index.html
```

---

# 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/Fish-Health-Optimization-in-an-Aquaponics-System-using-PSO.git
```

### 2. Navigate to the project folder

```bash
cd Fish-Health-Optimization-in-an-Aquaponics-System-using-PSO
```

### 3. Install the required dependencies

```bash
pip install flask numpy
```

### 4. Run the application

```bash
python app.py
```

### 5. Open in your browser

```
http://127.0.0.1:5000
```

---

# 🔮 Future Improvements

Possible future enhancements include:

- Database integration for storing optimization history
- User authentication
- IoT sensor integration for real-time monitoring
- Historical analytics dashboard
- Export optimization reports
- Additional fish species support

---

# 👥 Team

This project was developed as a **2-member academic team project**.

## Contributors

- Cherukuri Sri Nithya
- Saketh Aryan Amineni

---

# 📄 License

**MIT License**.