import { Particle } from "@/utils/Particle.class";
import { IOptions, STATUS, STATUS_COLOR } from "@/utils/types";
import { onMounted, ref } from "vue";
import P5 from "p5";

export function useSimulation(options: IOptions) {
  const play = ref<boolean>(true);
  const p5sketch = ref<any>(null);
  
  const susceptibles = ref<number>(options.amountParticles - options.i0);
  const infected = ref<number>(options.i0);
  const recovered = ref<number>(0);
  const diseased = ref<number>(0);

  const counter = ref<number>(0);
  const basicReproduction = ref<number | null>(0);
  const effectiveReproduction = ref<number | null>(0);
  const reproductionSeries = ref<any[]>([
    {
      name: "Basisreproduktionszahl",
      data: [],
    },
    {
      name: "Nettoreproduktionszahl",
      data: [],
    },
  ]);

  const dataSeries = ref<any[]>([
    {
      name: "Susceptibles",
      data: [],
    },
    {
      name: "Infected",
      data: [],
    },
    {
      name: "Recovered",
      data: [],
    },
    {
      name: "Diseased",
      data: [],
    },
  ]);

  const updateChart = () => {
    dataSeries.value[0].data = [
      ...dataSeries.value[0].data,
      susceptibles.value,
    ];
    dataSeries.value[1].data = [
      ...dataSeries.value[1].data,
      infected.value,
    ];
    dataSeries.value[2].data = [
      ...dataSeries.value[2].data,
      recovered.value,
    ];
    dataSeries.value[3].data = [
      ...dataSeries.value[3].data,
      diseased.value,
    ];

    reproductionSeries.value[0].data = [
      ...reproductionSeries.value[0].data,
      basicReproduction.value,
    ];
    reproductionSeries.value[1].data = [
      ...reproductionSeries.value[1].data,
      effectiveReproduction.value,
    ];
  };

  const sketch = (p5: any) => {
    let particles: Particle[] = [];

    function loop() {
      const ops: IOptions = options;

      if (ops.centralLocations) {
        ops.centralLocations.forEach((location) => {
          if (
            location.particles.length < options.centralParticleAmount!
          ) {
            const particlesInRadius = particles.filter(
              (particle) =>
                particle.distance(location.center.x, location.center.y) <
                options.centralLocationRadius!
            );

            if (particlesInRadius.length) {
              const particleIndex = Math.floor(
                Math.random() * particlesInRadius.length
              );
              location.particles.unshift(particlesInRadius[particleIndex]);
              particlesInRadius[particleIndex].travelTo(
                location.center.x,
                location.center.y,
                0
              );
            }
          } else if (Math.random() < options.centralExchangeRate!) {
            if (
              !location.particles[options.centralParticleAmount! - 1]
                .travelling
            ) {
              const particle = location.particles.pop();
              const ang = 2 * Math.PI * Math.random() - Math.PI;
              const x =
                location.center.x +
                Math.cos(ang) *
                  options.centralLocationRadius! *
                  Math.random();
              const y =
                location.center.y +
                Math.sin(ang) *
                  options.centralLocationRadius! *
                  Math.random();
              particle?.travelTo(x, y, options.speed);
            }
          }
        });
      }

      for (let i = 0; i < particles.length; i++) {
        particles[i].move(ops, particles);

        if (
          particles[i].status === STATUS.I &&
          particles[i].duration > ops.recoveryRate
        ) {
          if (Math.random() < ops.deathRate) {
            particles[i].status = STATUS.D;
            particles[i].d.x = 0;
            particles[i].d.y = 0;
            infected.value--;
            diseased.value++;
          } else {
            particles[i].status = STATUS.R;
            infected.value--;
            recovered.value++;
          }
        }

        p5.fill(STATUS_COLOR[particles[i].status]);
        p5.stroke(0, 0, 0);
        p5.ellipse(
          particles[i].x,
          particles[i].y,
          options.size,
          options.size
        );
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = 0; j < particles.length; j++) {
          if (i !== j) {
            let particleI: Particle = particles[i];
            let particleJ: Particle = particles[j];

            if (particleI.status === STATUS.I) {
              if (
                particleI.distance(particleJ.x, particleJ.y) <
                ops.infectionRadius
              ) {
                particleI.contactList = {
                  ...particleI.contactList,
                  [particleJ.id]: particleJ,
                };
              } else if (particleI.contactList[particleJ.id]) {
                if (particleI.contactList[particleJ.id].status === STATUS.S) {
                  if (Math.random() < ops.infectionRate) {
                    particleJ.status = STATUS.I;
                    infected.value++;
                    susceptibles.value--;
                  }
                  particleI.effectiveContacts++;
                }
                delete particleI.contactList[particleJ.id];
                particleI.basicContacts++;
              }
            }
          }
        }
      }

      if (infected.value) {
        const effectiveContacts =
          particles
            .filter((p) => p.status === STATUS.I)
            .reduce(
              (sum: number, p: Particle) =>
                sum + p.effectiveContacts * (ops.recoveryRate / p.duration),
              0
            ) / infected.value;

        const basicContacts =
          particles
            .filter((p) => p.status === STATUS.I)
            .reduce(
              (sum: number, p: Particle) =>
                sum + p.basicContacts * (ops.recoveryRate / p.duration),
              0
            ) / infected.value;

        effectiveReproduction.value = parseFloat(
          (effectiveContacts * ops.infectionRate).toFixed(2)
        );
        basicReproduction.value = parseFloat(
          (basicContacts * ops.infectionRate).toFixed(2)
        );
      } else {
        effectiveReproduction.value = null;
        basicReproduction.value = null;
      }
    }

    p5.setup = () => {
      p5.createCanvas(options.width, options.height);
      particles = [];

      for (
        let i = 0;
        i < options.amountParticles - options.i0;
        i++
      ) {
        particles.push(new Particle(i, STATUS.S, options));
      }

      for (let i = 0; i < options.i0; i++) {
        particles.push(
          new Particle(
            options.amountParticles + i,
            STATUS.I,
            options
          )
        );
      }
    };

    p5.draw = () => {
      if (play.value) {
        p5.background(33, 33, 33);

        if (options.centralLocations) {
          options.centralLocations.forEach((location) => {
            p5.fill("rgba(0,0,0,0)");
            p5.stroke("white");
            p5.circle(location.center.x, location.center.y, 30, 30);
          });
        }

        if (options.communities) {
          const communityWidth = options.width / options.communities;

          for (let x = 1; x < options.communities; x++) {
            p5.stroke("white");
            p5.strokeWeight(1);
            p5.line(x * communityWidth, 0, x * communityWidth, 500);
          }

          for (let y = 1; y < options.communities; y++) {
            p5.stroke("white");
            p5.strokeWeight(1);
            p5.line(0, y * communityWidth, 500, y * communityWidth);
          }
        }

        loop();

        if (counter.value % 24 === 0) {
          updateChart();
        }

        counter.value++;

        if (!infected.value) {
          updateChart();
          play.value = false;
        }
      }
    };
  };

  const restartSimulation = () => {
    play.value = true;
    counter.value = 0;

    dataSeries.value = [
      {
        name: "Susceptibles",
        data: [],
      },
      {
        name: "Infected",
        data: [],
      },
      {
        name: "Recovered",
        data: [],
      },
      {
        name: "Diseased",
        data: [],
      },
    ];

    reproductionSeries.value = [
      {
        name: "Basisreproduktionszahl",
        data: [],
      },
      {
        name: "Nettoreproduktionszahl",
        data: [],
      },
    ];

    susceptibles.value = options.amountParticles - options.i0;
    infected.value = options.i0;
    recovered.value = 0;
    diseased.value = 0;

    p5sketch.value.setup();
  };

  onMounted(() => {
    p5sketch.value = new P5(sketch, "simulation-window");
  });

  return {
    susceptibles,
    infected,
    recovered,
    diseased,
    play,
    restartSimulation,
    dataSeries,
    basicReproduction,
    reproductionSeries
  }
}