//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)

// Set 'tab' to 2 spaces (for best on-screen appearance)

/*=================
  CForcer Library
===================
 -- A collection of 'forcer' objects (see CForcer prototype below),

*/


// Array-name consts for Force Types.
//------------------------------------------------------------------------------

const F_NONE     = 0;       // Non-existent force: ignore this CForcer object
const F_MOUSE    = 1;       // Spring-like connection to the mouse cursor; lets
                            // you 'grab' and 'wiggle' one particle(or several).
const F_GRAV_E   = 2;       // Earth-gravity: pulls all particles 'downward'.
const F_GRAV_P   = 3;       // Planetary-gravity; particle-pair (e0,e1) attract
                            // each other with force== grav* mass0*mass1/ dist^2
const F_WIND     = 4;       // Blowing-wind-like force-field;fcn of 3D position
const F_BUBBLE   = 5;       // Constant inward force towards centerpoint if
                            // particle is > max_radius away from centerpoint.
const F_DRAG     = 6;       // Viscous drag -- proportional to neg. velocity.
const F_SPRING   = 7;       // ties together 2 particles; distance sets force
const F_SPRINGSET= 8;       // a big collection of identical springs; lets you
                            // make cloth & rubbery shapes as one force-making
                            // object, instead of many many F_SPRING objects.
const F_CHARGE   = 9;       // attract/repel by charge and inverse distance;
                            // applies to all charged particles.
const F_ALIGN    =10;       // exerts alignment force on particles around it
const F_MAX      =11;    // number of types of force-making objects available


//=============================================================================
function CForcer() {
  // Constructor for a new force;
  if (arguments.length < 1) {
    this.forceType = F_NONE;
    return;
  }
  this.init(...arguments);
}

// initialize the CForcer with a type and the associated constants
CForcer.prototype.init = function() {
  this.forceType = arguments[0];
  switch(arguments[0]) {
    case F_NONE:
      break;
    case F_GRAV_E:
      this.grav_e = arguments[1];
      break;
    case F_GRAV_P:
      this.grav_p = arguments[1];
      this.point = arguments[2];
      break;
    case F_WIND:
      this.forceFunc = arguments[1];
    case F_BUBBLE:
      this.bub_radius = arguments[1]; // bubble radius
      this.point = arguments[2];    // particle's point ID
      this.bub_force = arguments[3];  // inward-force's strength when outside the bubble
      break;
    case F_DRAG:
      this.drag = arguments[1];
      break;
    case F_SPRING:
      this.k_s = arguments[1];
      this.len_s = arguments[2];
      this.p0 = arguments[3];
      this.p1 = arguments[4];
      break;
    case F_SPRINGSET:
      this.k_s = arguments[1];
      this.len_s = arguments[2];
      this.pairs = arguments[3];
      break;
    case F_ALIGN:
      this.force = arguments[1];  // inward-force's strength when outside the bubble
      break;
    default:
      this.forceType = F_NONE;
      console.log("CForcer: Could not find forceType=" + arguments[0])
      break;
  }
}
