from flask import Flask, render_template, request, jsonify
import json
import random
import numpy as np
from math import log10, exp

app = Flask(__name__, static_folder="static", template_folder="templates")

# Load and validate species data
def validate_species_data(species_data):
    required_keys = ["temp", "pH", "DO", "ammonia", "nitrate", "feeding_rate", "weights"]
    required_weights = ["DO", "Temp", "pH", "NH3", "NO3"]

    for species, data in species_data.items():
        if not all(k in data for k in required_keys):
            raise ValueError(f"Species {species} missing required keys")

        for param in ["temp", "pH", "DO", "ammonia", "nitrate", "feeding_rate"]:
            if not (isinstance(data[param], list) and len(data[param]) == 2 and data[param][0] <= data[param][1]):
                raise ValueError(f"Invalid range for {param} in species {species}")

        if not all(k in data["weights"] for k in required_weights):
            raise ValueError(f"Species {species} missing required weights")

        if abs(sum(data["weights"].values()) - 1.0) > 1e-5:
            raise ValueError(f"Weights for species {species} do not sum to 1.0")

    return True


with open("species_data.json", "r", encoding="utf-8") as f:
    SPECIES = json.load(f)
    validate_species_data(SPECIES)

# === Scientific Constants ===
N_PARTICLES = 40
MAX_ITER = 100
W_START, W_END = 0.9, 0.4
C1, C2 = 2.0, 2.0
STAGNATION_LIMIT = 5
TOLERANCE = 1e-5

# Scientific coefficients (from aquaculture literature)
PROTEIN_CONTENT = 0.30      # 30% protein in feed
FCR_EFFICIENCY = 0.85       # Feed conversion efficiency
N_TO_NH3_CONVERSION = 0.092 # Protein N to NH3 conversion

# Nitrification kinetics (Metcalf & Eddy, 2014)
MU_MAX_NOS = 0.90      # Max growth rate Nitrosomonas (day⁻¹)
MU_MAX_NB = 0.70       # Max growth rate Nitrobacter (day⁻¹)

K_NH3 = 0.5                 # Half-saturation NH3 (mg/L)
K_NO2 = 0.5                 # Half-saturation NO2 (mg/L)
K_DO_NITRIFICATION = 0.5    # Half-saturation DO for nitrification (mg/L)
Y_NOS = 0.15                # Yield coefficient Nitrosomonas
Y_NB = 0.05                 # Yield coefficient Nitrobacter

# Aeration coefficients (Boyd, 2020)
K_LA_BASE = 0.0012     # Base oxygen transfer coefficient
R_FISH = 0.25          # Fish respiration rate (mg O2/kg fish/hour)
R_BIOFILM = 0.08       # Biofilm respiration rate


def clamp(x, a, b):
    return max(a, min(b, x))


def calculate_do_saturation(temp, salinity=0):
    """Calculate DO saturation using Boyd's equation"""
    return 14.624 - 0.3671 * temp + 0.00449 * temp**2 - 0.0966 * salinity


def predict_state(current, ctrl, biomass_kg, spec):
    T = current["temp"]
    pH = current["pH"]
    DO = current["DO"]
    NH3 = current["ammonia"]
    NO2 = current.get("nitrite", 0.1)  # Add nitrite tracking
    NO3 = current["nitrate"]
    alkalinity = current.get("alkalinity", 100)  # mg/L as CaCO3

    FR = ctrl["FR"]      # Feeding rate (% biomass)
    A = ctrl["A"]        # Aeration intensity (0-1 scale)
    WER = ctrl["WER"]    # Water exchange rate
    T_sp = ctrl["Temp_sp"]

    # === 1. AMMONIA PRODUCTION (Ebeling & Timmons, 2010) ===
    feed_input = FR * biomass_kg  # kg feed per day
    nh3_production = (feed_input * PROTEIN_CONTENT * N_TO_NH3_CONVERSION *
                      (1 - FCR_EFFICIENCY)) / biomass_kg

    # === 2. NITRIFICATION KINETICS (Metcalf & Eddy, 2014) ===
    # Nitrosomonas: NH3 -> NO2
    nh3_consumption = (MU_MAX_NOS * (NH3/(K_NH3 + NH3)) *
                       (DO/(K_DO_NITRIFICATION + DO)) * biomass_kg * 0.01)
    nh3_consumption = min(nh3_consumption, NH3 + nh3_production)

    # Nitrobacter: NO2 -> NO3
    no2_consumption = (MU_MAX_NB * (NO2/(K_NO2 + NO2)) *
                       (DO/(K_DO_NITRIFICATION + DO)) * biomass_kg * 0.01)
    
    no2_consumption = min(no2_consumption, NO2 + nh3_consumption * Y_NOS)

    # Update nitrogen species
    NH3_next = max(0.0, (NH3 + nh3_production - nh3_consumption) * (1 - WER))
    NO2_next = max(0.0, (NO2 + nh3_consumption * Y_NOS - no2_consumption) * (1 - WER))
    NO3_next = max(0.0, (NO3 + no2_consumption * Y_NB) * (1 - WER))

    # === 3. DISSOLVED OXYGEN (Boyd, 2020) ===
    do_sat = calculate_do_saturation(T)
    k_la = K_LA_BASE * (A ** 0.8) * (1.024 ** (T - 20))

    # Oxygen demands
    oxygen_demand = (R_FISH * biomass_kg +
                     R_BIOFILM * biomass_kg +
                     nh3_consumption * 3.43 +  # Nitrification oxygen demand
                     no2_consumption * 1.14)

    do_reaeration = k_la * (do_sat - DO)
    DO_next = clamp(DO + do_reaeration - oxygen_demand/24, 0.0, do_sat)

    # === 4. TEMPERATURE ===
    dT = clamp(T_sp - T, -2.0, 2.0)  # More realistic temperature change
    T_next = T + dT

    # === 5. pH FROM ALKALINITY & CO2 (Colt, 2012) ===
    # Simplified version: pH affected by nitrification and respiration
    co2_production = oxygen_demand * 1.2  # Respiratory quotient
    nitrification_acid = nh3_consumption * 0.14  # H+ production from nitrification

    # Simplified pH calculation based on alkalinity balance
    alk_change = nitrification_acid - co2_production * 0.05
    pH_next = pH - alk_change / alkalinity * 50  # Simplified relationship
    pH_next = clamp(pH_next, 5.0, 9.5)

    return {
        "temp": round(T_next, 2),
        "pH": round(pH_next, 3),
        "DO": round(DO_next, 3),
        "ammonia": round(NH3_next, 5),
        "nitrite": round(NO2_next, 5),
        "nitrate": round(NO3_next, 2)
    }

def compute_fhi(state, spec):
    w = spec["weights"]

    def norm(val, lo, hi):
        return clamp((val - lo) / (hi - lo), 0, 1)

    def inv_norm(val, max_bad):
        return max(0, 1 - clamp(val / max_bad, 0, 1))

    do_score = norm(state["DO"], *spec["DO"])

    # Temperature score (Gaussian distribution around optimum)
    t_mid = (spec["temp"][0] + spec["temp"][1]) / 2
    t_range = (spec["temp"][1] - spec["temp"][0]) / 2
    temp_score = max(0, 1 - min(abs(state["temp"] - t_mid) / t_range, 1))

    # pH score (Gaussian distribution around optimum)
    ph_mid = (spec["pH"][0] + spec["pH"][1]) / 2
    ph_range = (spec["pH"][1] - spec["pH"][0]) / 2
    ph_score = max(0, 1 - min(abs(state["pH"] - ph_mid) / ph_range, 1))

    nh3_score = inv_norm(state["ammonia"], spec["ammonia"][1])
    no3_score = inv_norm(state["nitrate"], spec["nitrate"][1])

    fhi = (w["DO"] * do_score +
           w["Temp"] * temp_score +
           w["pH"] * ph_score +
           w["NH3"] * nh3_score +
           w["NO3"] * no3_score)

    return max(0, fhi)


class Particle:
    def __init__(self, bounds):
        self.keys = list(bounds.keys())
        self.pos = np.array([random.uniform(*bounds[k]) for k in self.keys])
        self.vel = np.array([random.uniform(-0.1 * (bounds[k][1] - bounds[k][0]),
                                           0.1 * (bounds[k][1] - bounds[k][0])) for k in self.keys])
        self.best_pos = self.pos.copy()
        self.best_fhi = -float('inf')


def pso_optimize(species_key, current, biomass_kg):
    spec = SPECIES[species_key]
    bounds = {
        "FR": spec["feeding_rate"],
        "A": (0.0, 1.0),
        "WER": (0.0, 0.6),
        "Temp_sp": spec["temp"]
    }

    keys = list(bounds.keys())
    swarm = [Particle(bounds) for _ in range(N_PARTICLES)]
    gbest_pos = None
    gbest_fhi = -float('inf')
    convergence = []
    stagnation_count = 0
    prev_best = -float('inf')

    for it in range(MAX_ITER):
        w = W_START - (W_START - W_END) * (it / (MAX_ITER - 1)) if MAX_ITER > 1 else W_START

        for p in swarm:
            ctrl = {k: clamp(p.pos[i], *bounds[k]) for i, k in enumerate(keys)}
            pred = predict_state(current, ctrl, biomass_kg, spec)
            fhi = compute_fhi(pred, spec)

            if fhi > p.best_fhi:
                p.best_fhi = fhi
                p.best_pos = p.pos.copy()
            if fhi > gbest_fhi:
                gbest_fhi = fhi
                gbest_pos = p.pos.copy()

        convergence.append(round(gbest_fhi, 5))

        if it > 0:
            improvement = gbest_fhi - prev_best
            if improvement < TOLERANCE:
                stagnation_count += 1
            else:
                stagnation_count = 0

            if stagnation_count >= STAGNATION_LIMIT:
                print(f"Early stopping at iteration {it + 1}")
                break

        prev_best = gbest_fhi

        for p in swarm:
            r1, r2 = np.random.rand(len(keys)), np.random.rand(len(keys))
            cognitive = C1 * r1 * (p.best_pos - p.pos)
            social = C2 * r2 * (gbest_pos - p.pos) if gbest_pos is not None else 0

            p.vel = w * p.vel + cognitive + social

            for i, k in enumerate(keys):
                v_range = bounds[k][1] - bounds[k][0]
                p.vel[i] = clamp(p.vel[i], -v_range * 0.3, v_range * 0.3)
                p.pos[i] = clamp(p.pos[i] + p.vel[i], *bounds[k])

    best_ctrl = {k: round(gbest_pos[i], 3) for i, k in enumerate(keys)}

    pred = predict_state(current, best_ctrl, biomass_kg, spec)

    fhi_before = compute_fhi(current, spec)
    fhi_after = compute_fhi(pred, spec)

    return {
        "recommended": best_ctrl,
        "predicted_state": pred,
        "fhi_before": round(fhi_before, 4),
        "fhi_after": round(fhi_after, 4),
        "convergence": convergence,
        "iterations_used": len(convergence)
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/optimize", methods=["POST"])
def optimize():
    try:
        data = request.get_json()

        if not data or "species" not in data or "current_params" not in data or "biomass_kg" not in data:
            return jsonify({
                "error": "Missing required fields: species, current_params, biomass_kg"
            }), 400

        species = data["species"].lower()

        if species not in SPECIES:
            return jsonify({
                "error": f"Unknown species: {species}"
            }), 400

        raw = data["current_params"]

        required_params = ["temp", "pH", "do", "ammonia", "nitrate"]

        if not all(p in raw for p in required_params):
            return jsonify({
                "error": f"Missing parameters: {', '.join(set(required_params) - set(raw.keys()))}"
            }), 400
        current = {
            "temp": float(raw.get("temp", 25)),
            "pH": float(raw.get("pH", 7)),
            "DO": float(raw.get("do", 6)),
            "ammonia": float(raw.get("ammonia", 0)),
            "nitrate": float(raw.get("nitrate", 10)),
            "nitrite": float(raw.get("nitrite", 0.1)),
            "alkalinity": float(raw.get("alkalinity", 100))
        }

        biomass = float(data.get("biomass_kg", 10))

        if biomass <= 0:
            return jsonify({"error": "Biomass must be positive"}), 400

        result = pso_optimize(species, current, biomass)

        return jsonify({
            "recommended": result["recommended"],
            "predicted_state": result["predicted_state"],
            "fhi_before": result["fhi_before"],
            "fhi_after": result["fhi_after"],
            "convergence": result["convergence"],
            "iterations_used": result["iterations_used"]
        })

    except ValueError as e:
        return jsonify({"error": f"Invalid input: {str(e)}"}), 400

    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True)