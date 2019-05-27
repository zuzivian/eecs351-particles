//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)

// Set 'tab' to 2 spaces (for best on-screen appearance)

/*=================
  CLimit Library
===================
-- A collection of 'constraint' objects (see CLimit prototype below),

*/

// CLimit values;
//-------------------------------
// a) Specifies the type of constraint implemented by each CWall object, and
// b) gives you an easy way to enable/disable each constraint object:
//      partType >0 == active; partType < 0 == temporarily disabled;
//      Just reverse the sign of CWall::wallType to enable/disable an object.
// (an easier/faster way to vary the number of particles without resorting to
//  memory allocation/de-allocation.  Also useful for debugging).
// What's a 'Particle Set'?
//    Some constraints apply to all particles, some apply to one, some to two,
//      some to a selectable/changeable set, so CWall offers choices:

const WTYPE_DEAD      = 0;  // DEAD CONSTRAINT!!!  Abandoned, not in use, no
                          // meaningful values, available for re-use.
// Basic 'Wall' constraints;
//----------------------------
const WTYPE_GROUND    = 1;  // y=0 ground-plane; Kbouncy=0; keeps particle y>=0.
const WTYPE_XWALL_LO  = 2; // planar X wall; keeps particles >= xmin
const WTYPE_XWALL_HI  = 3;  // planar X wall; keeps particles <= xmax
const WTYPE_YWALL_LO  = 4;  // planar Y wall; keeps particles >= ymin
const WTYPE_YWALL_HI  = 5;  // planar Y wall; keeps particles <= ymax
const WTYPE_ZWALL_LO  = 6;  // planar Z wall; keeps particles >= zmin
const WTYPE_ZWALL_HI  = 7;  // planar Z wall; keeps particles <= zmax
const WTYPE_WALL_GEN  = 8;  // Generic wall; a plane that passes thru point at
                            // xpos,ypos,zpos, perpendicular to surface normal
                            // nx,ny,nz. Keep particle set on 'normal' side.
// Distance constraints
//----------------------------
const WTYPE_STICK     = 9;  // Connects 2 particles with fixed-length separation
                            // between particles whose indices are held in e0,e1
                            // (e.g. particles at pS0[e0] and pS0[e1] )
const WTYPE_PULLEY    =10;  // Keep constant sum-of-distances for 3 particles
                            // A,B,Pivot:  ||A-Pivot||+||B-Pivot|| = dmax.
const WTYPE_ANCHOR    =11;  // Lock one particle at location xpos,ypos,zpos

// Particle-Volume constraints;
//----------------------------
// (solid volume centered on one movable particle; no other particles allowed
//  inside that volume)
//  NOTE! does not affect encased particle's collisions with obstacle-volume
//        constraints defined below, e.g. solid sphere, solid box, etc.
const WTYPE_PBALL     =12;  // solid sphere centered at particle with index e0;
                            // no other particles allowed closer than 'radmin'
                            // to the e0 particle.
                            // (NOTE: e0 is a state-vector index: pS0[e0] )
const WTYPE_PBOX      =13;  // solid, axis-aligned box centered at the particle
                            // with index e0. Box width, height, length ==
                            //  +/-xmax, +/-ymax, +/-zmax, centered at location
                            // of particle pS0[e0].  No other particle allowed
                            // within the box.
// Obstacle-Volume constraints;
//---------------------------
    // solid shapes that keep particle sets OUTSIDE:
const WTYPE_VBOX_OUT  =14;  // solid box; (xmin,xmax,ymin,ymax,zmin,zmax)
const WTYPE_VBALL_OUT =15;  // solid sphere at xpos,ypos,zpos; radius radmin
const WTYPE_VCYL_OUT  =16;  // solid cylinder at xpos,ypos,zpos; radius radmin,
                            // cylinder length dmin, along direction nx,ny,nz
const WTYPE_VMESH_OUT =17;  // solid shape formed by vertex buffer object...
    // hollow shapes that keep particle sets INSIDE:
const WTYPE_VBOX_IN   =18;  // hollow box; (xmin,xmax,ymin,ymax,zmin,zmax)
const WTYPE_VBALL_IN  =19;  // hollow sphere at xpos,ypos,zpos, radius dmax
const WTYPE_VCYL_IN   =20;  // solid cylinder at xpos,ypos,zpos; radius radmax,
                            // cylinder length dmax
const WTYPE_VMESH_IN  =21;  // hollow shape formed by vertex buffer object....

// Surface constraints; restrict particle set to the surface of a shape:
//----------------------------
const WTYPE_SPLANE    =22;  // Plane thru point xpos,ypos,zpos; normal nx,ny,nz
const WTYPE_SDISK     =23;  // circular disk,radius radmax, in plane thru point
                            // xpos,ypos,zpos with surface normal nx,ny,nz.
const WTYPE_SBOX      =24;  // surface of box (xmin,xmax,ymin,ymax,zmin,zmax)
const WTYPE_SBALL     =25;  // surface of sphere at xpos,ypos,zpos;radius radmax
const WTYPE_SCYL      =26;  // solid cylinder at xpos,ypos,zpos; radius radmax,
                            // cylinder length dmax, along direction nx,ny,nz
const WTYPE_SMESH     =27;  // lock selected particles to a VBO's surface

// Line constraints; restrict particles to a 1-D path in 3D
//----------------------------
const WTYPE_SLOT      =28;   // line thru point xpos,ypos,zpos in direction of
                            // normal vector nx,ny,nz, length dmax.

// AGE CONSTRAINTS; restrict particles to a certain age
const WTYPE_AGE       =29;

const WTYPE_MAXVAR    =30;   // Number of CPart particle types available.

//=============================================================================
// Constructor for a new Limiter;
// var wallType;           // Constraint type; not required, but a) helps you
//                         // identify the intended purpose of each constraint,
//                         // and b) gives you an easy way to enable/disable
//                         // each constraint:
//                         //  wallType  >0 == active constraint; use it! the
//                         //                   value describes its use
//                         //  wallType ==0 == 'dead' constraint, abandoned,
//                         //                  ignored, available for re-use.
//                         //  wallType  <0 == temporarily disabled 'frozen';
//                         //                  to re-enable this particle,
//                         //                  set wallType = -wallType;
// var resti;         // Coeff. of restoration for constraint surfaces:
//                         // Particles moving at speed ||V|| will bounce off
//                         // a constraint surface and lose some energy; after
//                         // the bounce, speed is ||V||*Kbouncy.
//                         //   0.0 <= Kbouncy <= 1.0;     'no bounce'== 0.0;
//                         //                          'perfect bounce'==1.0.
// // Some, not all of values below used for some, not all of the many types
// // of constraints we can select by setting wallType value.
// var xpos,ypos,zpos;  // 3D position value
// var xmin,xmax,ymin,ymax,zmin,zmax;   // min/max 3D positions
// var wallSize;        // limit on size of WTYPE_WALL constraints; wall
//                         // extends outwards +/-wallSize from its starting
//                         // point at xpos,ypos,zpos.  If wallSize <= 0.0,
//                         // then wall size is unlimited.
// var nx,ny,nz;        // 3D surface normal vector value
// var dmin,dmax;       // minimum, maximum distance value
// var radmin,radmax;   // minimum, maximum radius for sphere, cyl, circle
// var thetamin,thetamax;   // min, max angle for rotations.
// var isVisible;          // ==1 means CPartSys::wallVecDraw() can draw it,
//                         // ==0 means it won't get drawn on-screen.
function CLimit() {
  if (arguments.length < 1) {
    this.limitType = WTYPE_DEAD;
    return;
  }
  this.init(...arguments);
}

// initialize the CLimit with a type and the associated constants

CLimit.prototype.init = function() {
  this.limitType = arguments[0];
  switch(arguments[0]) {
    case WTYPE_DEAD:
      break;
    case WTYPE_XWALL_LO:
    case WTYPE_XWALL_HI:
    case WTYPE_YWALL_LO:
    case WTYPE_YWALL_HI:
    case WTYPE_ZWALL_LO:
    case WTYPE_ZWALL_HI:
      this.pos = arguments[1];
      this.resti = arguments[2];
      this.isVisible = arguments[3];
      break;
    case WTYPE_ANCHOR:
      this.points = arguments[1];
      break;
    case WTYPE_AGE:
      this.mean = arguments[1];
      this.variance = arguments[2];
      break;
    default:
      this.limitType = WTYPE_DEAD;
      console.log("CLimit: Could not find limitType=" + arguments[0])
      break;
  }
}

// Draw grid of lines on the plane that:
//      --centered at Pcenter == xpos,ypos,zpos, and
//      --uses surface normal vector nx,ny,nz.
// The grid of lines extends outwards from Pcenter to cover (+/-size, +/-size)
//on the plane, with grid-spacing xygap parallel to x,y axes.
CLimit.prototype.drawGrid = function(size, gridgap) {
  console.log("CLimit.drawGrid not implemented")
}

// draw a grid of lines in the z=0 plane to cover an area spanning +/-size on
// both axes, with grid spacing xygap between lines parallel to x and y axes.
CLimit.prototype.drawGridZplane = function(zval, size, gridgap) {
  console.log("CLimit.drawGridZplane not implemented")
}
