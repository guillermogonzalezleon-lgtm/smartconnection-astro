/* ========================================
   Particle Starfield + Network Effect
   Hero background animation
   ======================================== */

(function () {
  var canvas = document.getElementById('heroCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var particles = [];
  var particleCount = 120;
  var connectDistance = 150;
  var mouse = { x: null, y: null };

  function resize() {
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  canvas.addEventListener('mousemove', function (e) {
    var rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  canvas.addEventListener('mouseleave', function () {
    mouse.x = null;
    mouse.y = null;
  });

  // Create particles
  function Particle() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.radius = Math.random() * 2 + 0.5;
    this.opacity = Math.random() * 0.5 + 0.2;
    // Some particles are gold, most are cyan
    this.isGold = Math.random() < 0.15;
  }

  for (var i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  // Shooting stars
  var shootingStars = [];
  function createShootingStar() {
    if (shootingStars.length < 2 && Math.random() < 0.005) {
      shootingStars.push({
        x: Math.random() * canvas.width,
        y: 0,
        vx: (Math.random() - 0.3) * 4,
        vy: Math.random() * 3 + 2,
        life: 1,
        length: Math.random() * 80 + 40
      });
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw particles
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      // Mouse interaction
      if (mouse.x !== null) {
        var dx = mouse.x - p.x;
        var dy = mouse.y - p.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          p.x -= dx * 0.005;
          p.y -= dy * 0.005;
        }
      }

      // Draw particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      if (p.isGold) {
        ctx.fillStyle = 'rgba(240, 171, 0, ' + p.opacity + ')';
      } else {
        ctx.fillStyle = 'rgba(0, 193, 193, ' + p.opacity + ')';
      }
      ctx.fill();

      // Glow effect for larger particles
      if (p.radius > 1.5) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
        if (p.isGold) {
          ctx.fillStyle = 'rgba(240, 171, 0, ' + (p.opacity * 0.1) + ')';
        } else {
          ctx.fillStyle = 'rgba(0, 193, 193, ' + (p.opacity * 0.1) + ')';
        }
        ctx.fill();
      }

      // Connect nearby particles
      for (var j = i + 1; j < particles.length; j++) {
        var p2 = particles[j];
        var dx2 = p.x - p2.x;
        var dy2 = p.y - p2.y;
        var dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (dist2 < connectDistance) {
          var alpha = (1 - dist2 / connectDistance) * 0.15;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = 'rgba(0, 193, 193, ' + alpha + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Shooting stars
    createShootingStar();
    for (var s = shootingStars.length - 1; s >= 0; s--) {
      var star = shootingStars[s];
      star.x += star.vx;
      star.y += star.vy;
      star.life -= 0.008;

      if (star.life <= 0) {
        shootingStars.splice(s, 1);
        continue;
      }

      var gradient = ctx.createLinearGradient(
        star.x, star.y,
        star.x - star.vx * star.length / 3,
        star.y - star.vy * star.length / 3
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, ' + star.life + ')');
      gradient.addColorStop(1, 'rgba(0, 193, 193, 0)');

      ctx.beginPath();
      ctx.moveTo(star.x, star.y);
      ctx.lineTo(
        star.x - star.vx * star.length / 3,
        star.y - star.vy * star.length / 3
      );
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    requestAnimationFrame(animate);
  }

  animate();
})();
