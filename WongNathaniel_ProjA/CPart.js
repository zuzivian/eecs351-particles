//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)

// Set 'tab' to 2 spaces (for best on-screen appearance)

/*=================
  PartSys Library
===================
 -- Each particle is an identical sequence of floating-point parameters defined
  by the extensible of array-index names defined as constants near the top of
  this file.  For example: PART_XPOS for x-coordinate of position, PART_YPOS
  for particle's y-coord, and finally PART_MAXVAL defines total # of parameters.
  To access parameter PART_YVEL of the 17th particle in state var s0, use:
  this.s0[PART_YVEL + 17*PART_MAXVAL].


// Array-name consts for State-variables.
/*------------------------------------------------------------------------------
     Each state-variable is a Float32Array object that holds 'this.partCount'
particles. For each particle the state var holds exactly PART_MAXVAR elements
(aka the particles' 'parameters') arranged in the sequence given by these
array-name consts.
------------------------------------------------------------------------------*/
const PART_XPOS     = 0;  //  position
const PART_YPOS     = 1;
const PART_ZPOS     = 2;
const PART_WPOS     = 3;  // (why include w? for matrix transforms; for vector/point distinction
const PART_XVEL     = 4;  //  velocity -- ALWAYS a vector: x,y,z; no w. (w==0)
const PART_YVEL     = 5;
const PART_ZVEL     = 6;
const PART_X_FTOT   = 7;  // force accumulator:'ApplyForces()' fcn clears
const PART_Y_FTOT   = 8;  // to zero, then adds each force to each particle.
const PART_Z_FTOT   = 9;
const PART_R        =10;  // color : red,green,blue, alpha (opacity); 0<=RGBA<=1.0
const PART_G        =11;
const PART_B        =12;
const PART_MASS     =13;  // mass
const PART_DIAM 	  =14;	// on-screen diameter (in pixels)
const PART_RENDMODE =15;	// on-screen appearance (square, round, or soft-round)
// Other useful particle values, currently unused
const PART_AGE      =16;  // # of frame-times since creation/initialization
const PART_CHARGE   =17;  // for electrostatic repulsion/attraction
const PART_MASS_VEL =18;  // time-rate-of-change of mass.
const PART_MASS_FTOT=19;  // force-accumulator for mass-change
const PART_R_VEL    =20;  // time-rate-of-change of color:red
const PART_G_VEL    =21;  // time-rate-of-change of color:grn
const PART_B_VEL    =22;  // time-rate-of-change of color:blu
const PART_R_FTOT   =23;  // force-accumulator for color-change: red
const PART_G_FTOT   =24;  // force-accumulator for color-change: grn
const PART_B_FTOT   =25;  // force-accumulator for color-change: blu

const PART_MAXVAR   =17;  // Size of array in CPart uses to store its values.

// CPart: partType values
//-------------------------------
// a) Specifies how to draw/render each individual particle (CPart object), and
// b) gives you an easy way to enable/disable each particle:
//      partType >0 == active; partType < 0 == temporarily disabled.
//      Just reverse the sign of CPart::partType to enable/disable an object.
// (an easier/faster way to vary the number of particles without resorting to
//  memory allocation/de-allocation.  Also useful for debugging).
const PTYPE_DEAD      =0;   // DEAD PARTICLE!!!  Abandoned, not in use, no
                            // meaningful values, available for re-use.
const PTYPE_ALIVE     =1;   // 'default' particle; generic drawing
const PTYPE_DUST      =2;   // Tiny dust-like particle
const PTYPE_BALL      =3;   // small bouncy round shiny sphere particle
const PTYPE_SUN       =4;   // big yellow sun-like particle for sun/planets
const PTYPE_STREAK    =5;   // Streak-like particle; rendered as GL_LINES using
                            // current and previous positions (fireworks, etc)
const PTYPE_SPRITE    =6;  // Rendered as RGBA 'sprite'; a transparent little
                            // 2D picture, e.g. blurry splat for snow, smoke,etc
const PTYPE_BLOBBY    =7;   // Render using Blinns' 'Blobby Implicits'--a blob
                            // that merges with neighbors to look like water...
const PTYPE_MAXVAR    =8;   // Number of CPart particle types available.


// Declares a class for objects that each describe one complete single particle.
// (The CPartSys class defines 'state' as an array of CPart objects).
// The simplest possible particle object contains member variables for:
//      mass, position, velocity, forceAccumulator,
// but you can add other descriptors, including color, age, direction, and even
// emotional and behavioral variables such as fear, hunger, wing position etc.
function CPart() {
  // Constructor for a new particle;
  this.partType = PTYPE_DEAD;

  for (let i=0; i < PART_MAXVAR; i++) {
    this[i] = 0.0;
  }
}

CPart.prototype.getArray = function() {
  var arr = new Float32Array(PART_MAXVAR);
  for (let i=0; i < PART_MAXVAR; i++) {
    arr[i] = this[i];
  }
  return arr;
}

CPart.prototype.setArray = function(arr) {
  for (let i=0; i < PART_MAXVAR; i++) {
    this[i] = arr[i];
  }
  return;
}
