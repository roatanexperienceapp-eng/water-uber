// "It's raining — here's what you can do." Data for a future portal (placement not decided yet).
// Researched 19 Oct 2026. Items marked confirmed: false need a call before they go in the app.
export interface RainyIdea {
  id: string;
  name: string;
  area: string;
  why: string;
  confirmed: boolean;
}

export const RAINY_DAY: RainyIdea[] = [
  { id: 'dive', name: 'Scuba diving', area: 'Whole island', why: 'Rain doesn\'t matter underwater. Not in lightning or rough seas — check the sea report.', confirmed: true },
  { id: 'museum', name: 'Roatán Museum & dolphin show', area: "Sandy Bay (Anthony's Key)", why: 'Indoor museum of island history, next to the dolphin show.', confirmed: true },
  { id: 'chocolate', name: 'Roatán Chocolate Factory', area: 'West End', why: 'Indoor tour and tasting, under an hour; also a café.', confirmed: true },
  { id: 'taste-tour', name: 'Taste of Roatán food tour', area: 'West End', why: 'Covered tastings, chocolate factory and a gallery.', confirmed: true },
  { id: 'rum', name: 'Chocolate & rum tasting tours', area: 'Various', why: 'Indoor tastings sold with island tours.', confirmed: true },
  { id: 'spa', name: 'Spa day (e.g. Kao Kamasa Spa at Kimpton Grand Roatan)', area: 'West Bay', why: 'Indoor treatments; book ahead on cruise days.', confirmed: true },
  { id: 'submarine', name: 'Submarine dive', area: 'Ask operator', why: 'Underwater, so rain-proof. Confirm the operator and that it still runs.', confirmed: false },
  { id: 'garifuna-food', name: 'Garifuna lunch in Punta Gorda', area: 'Punta Gorda', why: 'Covered local restaurants; traditional food and culture.', confirmed: true },
  { id: 'long-lunch', name: 'Long lunch at a covered restaurant', area: 'West End / West Bay / Sandy Bay', why: 'Use the Restaurants portal; many are open-air but roofed.', confirmed: true },
  { id: 'market', name: 'Coxen Hole municipal market & shops', area: 'Coxen Hole', why: 'Covered market and stores near the cruise port.', confirmed: true },
  { id: 'mall', name: 'Shopping mall in French Harbour', area: 'French Harbour', why: 'Indoor shops and food court. Confirm name, hours and whether there is a cinema.', confirmed: false },
];
