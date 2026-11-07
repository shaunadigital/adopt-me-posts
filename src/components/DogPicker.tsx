import type { Dog } from '../../shared/dogs'

interface Props {
  dogs: Dog[]
  selected: string
  onSelect: (slug: string) => void
}

export function DogPicker({ dogs, selected, onSelect }: Props) {
  return (
    <section className="dogs" aria-labelledby="dogs-title">
      <div className="dogs__head">
        <h2 id="dogs-title" className="section-title">
          Up for adoption
        </h2>
        <span className="muted">{dogs.length} dogs. Pick one to write their post.</span>
      </div>
      <div className="dog-grid">
        {dogs.map((dog) => (
          <button
            key={dog.slug}
            type="button"
            className="dog-card"
            aria-pressed={dog.slug === selected}
            onClick={() => onSelect(dog.slug)}
          >
            <img className="dog-card__photo" src={dog.photo} alt="" width={52} height={52} />
            <span className="dog-card__text">
              <span className="dog-card__id">{dog.id}</span>
              <span className="dog-card__name">{dog.name}</span>
              <span className="dog-card__blurb">{dog.blurb}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
